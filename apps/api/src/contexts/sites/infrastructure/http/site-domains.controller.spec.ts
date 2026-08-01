import { describe, expect, it, vi } from "vitest";
import { ROLES_KEY } from "../../../shared/infrastructure/http/roles.decorator.js";
import { AddDomainCommand } from "../../application/commands/add-domain/add-domain.handler.js";
import { ListDomainsQuery } from "../../application/queries/list-domains/list-domains.handler.js";
import { SiteDomainsController } from "./site-domains.controller.js";

describe("SiteDomainsController", () => {
  it("restringe la gestión de dominios a owner/admin", () => {
    expect(Reflect.getMetadata(ROLES_KEY, SiteDomainsController)).toEqual(["owner", "admin"]);
  });

  it("lista dominios propios con instrucciones DNS", async () => {
    const execute = vi.fn(async () => []);
    const controller = new SiteDomainsController({ execute } as never, { execute } as never);

    await controller.list();

    expect(execute).toHaveBeenCalledWith(new ListDomainsQuery());
  });

  it("crea dominio propio delegando en el comando", async () => {
    const execute = vi.fn(async () => ({ id: "domain-1" }));
    const controller = new SiteDomainsController({ execute } as never, { execute } as never);

    await controller.add({ hostname: "academia.test" });

    expect(execute).toHaveBeenCalledWith(new AddDomainCommand({ hostname: "academia.test" }));
  });
});
