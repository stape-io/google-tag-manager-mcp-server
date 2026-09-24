import { describe, expect, it } from "vitest";
import {
  json,
  TEST_WORKSPACE_PATH,
  useGoogleApiStub,
} from "./googleApiStub.js";

const google = useGoogleApiStub();

describe("gtm_template importFromGallery", () => {
  const args = {
    action: "importFromGallery",
    accountId: "1",
    containerId: "2",
    workspaceId: "3",
    galleryOwner: "stape-io",
    galleryRepository: "facebook-tag",
  };

  it("calls templates:import_from_gallery with the gallery coordinates", async () => {
    google.respond = (): Response =>
      json({ templateId: "42", name: "Facebook CAPI" });

    const { isError, text } = await google.callTool("gtm_template", {
      ...args,
      gallerySha: "abc123",
      acknowledgePermissions: true,
    });

    expect(isError).toBeFalsy();
    expect(JSON.parse(text).templateId).toBe("42");
    expect(google.calls).toHaveLength(1);

    const url = new URL(google.calls[0].url);
    expect(google.calls[0].method).toBe("POST");
    expect(url.pathname).toBe(
      `/tagmanager/v2/${TEST_WORKSPACE_PATH}/templates:import_from_gallery`,
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      galleryOwner: "stape-io",
      galleryRepository: "facebook-tag",
      gallerySha: "abc123",
      acknowledgePermissions: "true",
    });
  });

  it.each([
    ["acknowledgePermissions is missing", {}],
    ["acknowledgePermissions is false", { acknowledgePermissions: false }],
    [
      "galleryOwner is missing",
      { acknowledgePermissions: true, galleryOwner: undefined },
    ],
    [
      "galleryRepository is missing",
      { acknowledgePermissions: true, galleryRepository: undefined },
    ],
  ])("refuses without calling Google when %s", async (_, overrides) => {
    const { isError } = await google.callTool("gtm_template", {
      ...args,
      ...overrides,
    });

    expect(isError).toBe(true);
    expect(google.calls).toHaveLength(0);
  });
});
