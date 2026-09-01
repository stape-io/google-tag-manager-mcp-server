import { GOOGLE_TOKEN_URL, GTM_API_SCOPES } from "../constants/scopes.js";
import { GtmAuthProvider } from "../types/index.js";
import {
  createCachedTokenSource,
  nowInSeconds,
  requestGoogleToken,
} from "./tokenCache.js";

type SigningKey = Awaited<ReturnType<typeof crypto.subtle.importKey>>;

const JWT_BEARER_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:jwt-bearer";
const ASSERTION_LIFETIME_SECONDS = 3600;

export type ServiceAccountAuthConfig = {
  clientEmail: string;
  /** PKCS#8 PEM private key. Literal "\n" sequences are accepted. */
  privateKey: string;
  scopes?: string[];
  /** Workspace user to impersonate through domain-wide delegation. */
  subject?: string;
  tokenUrl?: string;
};

export type ServiceAccountKey = {
  clientEmail: string;
  privateKey: string;
};

export function parseServiceAccountKey(raw: string): ServiceAccountKey {
  let parsed: { client_email?: string; private_key?: string };

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Service account key is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!parsed.client_email || !parsed.private_key) {
    throw new Error(
      "Service account key must contain 'client_email' and 'private_key'.",
    );
  }

  return {
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key,
  };
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function encodeJsonSegment(value: unknown): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

function pemToPkcs8(privateKey: string): Uint8Array {
  const base64 = privateKey
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");

  if (!base64) {
    throw new Error("Service account private key is empty.");
  }

  let binary: string;
  try {
    binary = atob(base64);
  } catch {
    throw new Error(
      "Service account private key is not valid base64 - check that it is the full PKCS#8 key and that its newlines survived being put in configuration.",
    );
  }

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function signAssertion(
  config: ServiceAccountAuthConfig,
  tokenUrl: string,
  signingKey: SigningKey,
): Promise<string> {
  const issuedAt = nowInSeconds();
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: config.clientEmail,
    scope: (config.scopes ?? GTM_API_SCOPES).join(" "),
    aud: tokenUrl,
    exp: issuedAt + ASSERTION_LIFETIME_SECONDS,
    iat: issuedAt,
    ...(config.subject ? { sub: config.subject } : {}),
  };

  const signingInput = `${encodeJsonSegment(header)}.${encodeJsonSegment(claims)}`;

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    signingKey,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/** Signs with WebCrypto, not node:crypto - this also runs on Workers. */
export function createServiceAccountAuth(
  config: ServiceAccountAuthConfig,
): GtmAuthProvider {
  if (!config.clientEmail || !config.privateKey) {
    throw new Error(
      "Service account auth requires clientEmail and privateKey.",
    );
  }

  const tokenUrl = config.tokenUrl ?? GOOGLE_TOKEN_URL;

  // Decoded eagerly: a mangled key must fail where it is configured, not on
  // the first tool call.
  const pkcs8 = pemToPkcs8(config.privateKey);

  let signingKey: Promise<SigningKey> | null = null;
  const importSigningKey = (): Promise<SigningKey> => {
    signingKey ??= crypto.subtle.importKey(
      "pkcs8",
      pkcs8,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
    return signingKey;
  };

  const getAccessToken = createCachedTokenSource(async () =>
    requestGoogleToken(tokenUrl, {
      grant_type: JWT_BEARER_GRANT_TYPE,
      assertion: await signAssertion(
        config,
        tokenUrl,
        await importSigningKey(),
      ),
    }),
  );

  return { getAccessToken };
}
