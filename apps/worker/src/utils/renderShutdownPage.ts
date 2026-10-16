import { CUTOVER_TEXT, NEW_HOST, OLD_HOST } from "./hostNotice";

// Same steps as SHUTDOWN_NOTICE, laid out for reading in a browser. Everything
// interpolated here is a constant, so nothing needs escaping.
const urlChange = (path: string): string => `
          <div class="url-change">
            <div class="url-row">
              <span class="tag">Old</span>
              <code class="old">https://${OLD_HOST}${path}</code>
            </div>
            <div class="url-row">
              <span class="tag tag-new">New</span>
              <code class="new">https://${NEW_HOST}${path}</code>
            </div>
          </div>`;

/** Shown instead of a Google sign-in on the old host after the cutover. */
export const renderShutdownPage = (): string => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex,nofollow" />
    <title>${OLD_HOST} was shut down</title>
    <style>
          :root {
              --text: #1f2937;
              --muted: #4b5563;
              --background: #f9fafb;
              --card: #fff;
              --border: #e5e7eb;
              --code-background: #f3f4f6;
              --accent: #0070f3;
              --badge-text: #9a3412;
              --badge-background: #ffedd5;
              --old: #6b7280;
              --new: #047857;
              --new-background: #d1fae5;
          }

          @media (prefers-color-scheme: dark) {
              :root {
                  --text: #f3f4f6;
                  --muted: #d1d5db;
                  --background: #111827;
                  --card: #1f2937;
                  --border: #374151;
                  --code-background: #111827;
                  --accent: #60a5fa;
                  --badge-text: #fed7aa;
                  --badge-background: #7c2d12;
                  --old: #9ca3af;
                  --new: #6ee7b7;
                  --new-background: #064e3b;
              }
          }

          body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              font-size: 16px;
              line-height: 1.6;
              color: var(--text);
              background: var(--background);
              margin: 0;
              padding: 48px 16px;
          }

          main {
              max-width: 640px;
              margin: 0 auto;
              background: var(--card);
              border: 1px solid var(--border);
              border-radius: 12px;
              box-shadow: 0 8px 36px 8px rgba(0, 0, 0, 0.06);
              padding: 32px;
          }

          .badge {
              display: inline-block;
              margin: 0 0 16px;
              padding: 4px 12px;
              border-radius: 6px;
              font-size: 14px;
              font-weight: 600;
              color: var(--badge-text);
              background: var(--badge-background);
          }

          h1 {
              margin: 0 0 8px;
              font-size: 28px;
              line-height: 1.25;
              overflow-wrap: anywhere;
          }

          .lead {
              margin: 0 0 32px;
              font-size: 18px;
              color: var(--muted);
          }

          ol {
              list-style: none;
              counter-reset: step;
              margin: 0;
              padding: 0;
          }

          ol > li {
              counter-increment: step;
              position: relative;
              padding-left: 44px;
              margin-bottom: 28px;
          }

          ol > li::before {
              content: counter(step);
              position: absolute;
              left: 0;
              top: 0;
              width: 28px;
              height: 28px;
              border-radius: 50%;
              background: var(--accent);
              color: var(--card);
              font-weight: 700;
              font-size: 15px;
              line-height: 28px;
              text-align: center;
          }

          h2 {
              margin: 0 0 4px;
              font-size: 18px;
              line-height: 28px;
          }

          li p {
              margin: 0 0 12px;
              color: var(--muted);
          }

          code {
              font-family: SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
              font-size: 0.9em;
              overflow-wrap: anywhere;
          }

          p code {
              padding: 1px 6px;
              border-radius: 4px;
              background: var(--code-background);
              color: var(--text);
              white-space: nowrap;
          }

          .url-change {
              border: 1px solid var(--border);
              border-radius: 8px;
              padding: 8px 12px;
              margin-bottom: 8px;
              overflow-x: auto;
          }

          .url-row {
              display: flex;
              align-items: baseline;
              gap: 12px;
              padding: 4px 0;
          }

          .tag {
              flex: none;
              width: 40px;
              font-size: 12px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: var(--old);
          }

          .tag-new {
              color: var(--new);
          }

          .url-row code {
              white-space: nowrap;
          }

          .old {
              color: var(--old);
              text-decoration: line-through;
          }

          .new {
              padding: 1px 6px;
              border-radius: 4px;
              background: var(--new-background);
              color: var(--new);
              font-weight: 600;
              user-select: all;
          }

          .note {
              margin: 0;
              padding: 12px 16px;
              border-left: 4px solid var(--border);
              background: var(--code-background);
              border-radius: 0 8px 8px 0;
              color: var(--muted);
          }

          @media (max-width: 480px) {
              body {
                  padding: 12px;
              }

              main {
                  padding: 24px 16px;
              }

              h1 {
                  font-size: 24px;
              }

              ol > li {
                  padding-left: 0;
              }

              ol > li::before {
                  position: static;
                  display: inline-block;
                  margin-bottom: 8px;
              }

              .url-row {
                  flex-direction: column;
                  gap: 0;
              }

              .url-row code {
                  font-size: 13px;
              }
          }
    </style>
    </head>
    <body>
    <main>
      <p class="badge">Shut down on ${CUTOVER_TEXT}</p>
      <h1>${OLD_HOST} was shut down</h1>
      <p class="lead">This MCP server moved to <strong>${NEW_HOST}</strong>. Update your MCP client to keep using it.</p>
      <ol>
        <li>
          <h2>Change the server URL</h2>
          <p>In your MCP client config, replace <code>${OLD_HOST}</code> with <code>${NEW_HOST}</code> and keep the path.</p>
          ${urlChange("/mcp")}
          ${urlChange("/sse")}
        </li>
        <li>
          <h2>Sign in with Google again</h2>
          <p>${NEW_HOST} has its own sign-in, so your client asks you to sign in when it reconnects.</p>
        </li>
      </ol>
      <p class="note">If your organization manages this connector, ask an admin to change its URL.</p>
    </main>
    </body>
    </html>
  `;
