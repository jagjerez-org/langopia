import { describe, expect, it, vi } from "vitest";
import { NotFoundError } from "../../../shared/domain/errors/domain-error.js";
import {
  GetPublicSiteByHostQuery,
  GetPublicSitePageQuery,
} from "../../application/queries/get-site-by-host/get-public-site-by-host.handler.js";
import { PublicSitesController } from "./public-sites.controller.js";

function response() {
  return { setHeader: vi.fn() };
}

function request(ip: string) {
  return { ip, socket: {} };
}

describe("PublicSitesController", () => {
  it("devuelve 404 para un host desconocido", async () => {
    const execute = vi.fn(async () => {
      throw new NotFoundError("sitio público", "unknown.example.test");
    });
    const controller = new PublicSitesController({ execute } as never);

    await expect(
      controller.resolve("unknown.example.test", request("203.0.113.10") as never, response() as never),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(execute).toHaveBeenCalledWith(
      new GetPublicSiteByHostQuery({ host: "unknown.example.test" }),
    );
  });

  it("marca respuestas públicas con cache control", async () => {
    const execute = vi.fn(async () => ({ site: { id: "site-1" }, pages: [] }));
    const res = response();
    const controller = new PublicSitesController({ execute } as never);

    await controller.resolve("school.example.test", request("203.0.113.11") as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "public, max-age=60, stale-while-revalidate=300",
    );
  });

  it("limita peticiones repetidas por IP", async () => {
    const execute = vi.fn(async () => ({ site: { id: "site-1" }, pages: [] }));
    const controller = new PublicSitesController({ execute } as never, {
      windowMs: 60_000,
      maxRequests: 2,
      now: () => 1_000,
    });

    await controller.resolve("school.example.test", request("203.0.113.12") as never, response() as never);
    await controller.resolve("school.example.test", request("203.0.113.12") as never, response() as never);

    await expect(
      controller.resolve("school.example.test", request("203.0.113.12") as never, response() as never),
    ).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("traduce la página pública a query bus", async () => {
    const execute = vi.fn(async () => ({ page: { slug: "cursos" }, blocks: [] }));
    const controller = new PublicSitesController({ execute } as never);

    await controller.page("site-1", "cursos", request("203.0.113.13") as never, response() as never);

    expect(execute).toHaveBeenCalledWith(
      new GetPublicSitePageQuery({ siteId: "site-1", slug: "cursos" }),
    );
  });
});
