import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveSiteForRequest } from "./site-resolution";

describe("resolveSiteForRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves a known host through the public API", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe(
        "http://api.test/api/v1/public/sites/resolve?host=demo.langopia.test",
      );

      return Response.json({ schoolId: "school-a", slug: "demo" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveSiteForRequest({
      apiUrl: "http://api.test",
      request: new Request("https://demo.langopia.test/", {
        headers: { host: "demo.langopia.test" },
      }),
    });

    expect(result).toEqual({ schoolId: "school-a", slug: "demo" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("normalizes hosts that include a port", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe(
        "http://api.test/api/v1/public/sites/resolve?host=demo.langopia.test",
      );

      return Response.json({ schoolId: "school-a" });
    });
    vi.stubGlobal("fetch", fetchMock);

    await resolveSiteForRequest({
      apiUrl: "http://api.test",
      request: new Request("http://demo.langopia.test:4321/", {
        headers: { host: "demo.langopia.test:4321" },
      }),
    });

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("returns null when the API does not know the host", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("No encontrado", { status: 404 })),
    );

    const result = await resolveSiteForRequest({
      apiUrl: "http://api.test",
      request: new Request("https://unknown.langopia.test/", {
        headers: { host: "unknown.langopia.test" },
      }),
    });

    expect(result).toBeNull();
  });
});
