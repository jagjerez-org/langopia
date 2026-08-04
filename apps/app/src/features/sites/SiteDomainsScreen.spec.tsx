import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SiteDomainView } from "./api.js";

const { listSiteDomainsMock, addSiteDomainMock, copyMock } = vi.hoisted(() => ({
  listSiteDomainsMock: vi.fn(),
  addSiteDomainMock: vi.fn(),
  copyMock: vi.fn(),
}));

vi.mock("./api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api.js")>();
  return {
    ...actual,
    listSiteDomains: listSiteDomainsMock,
    addSiteDomain: addSiteDomainMock,
  };
});

const { SiteDomainsScreen, txtRecordText } = await import("./SiteDomainsScreen.js");

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SiteDomainsScreen />
    </QueryClientProvider>,
  );
}

const pendingDomain: SiteDomainView = {
  id: "domain-1",
  hostname: "academia.test",
  status: "pending",
  isPrimary: false,
  createdAt: "2026-07-28T10:00:00.000Z",
  expiresAt: "2026-07-30T10:00:00.000Z",
  verifiedAt: null,
  failedAt: null,
  failureReason: null,
  tlsIssuedAt: null,
  tlsStatus: "pending",
  verification: {
    type: "TXT",
    name: "_langopia.academia.test",
    value: "langopia-domain-verification_token",
  },
};

describe("SiteDomainsScreen", () => {
  beforeEach(() => {
    listSiteDomainsMock.mockReset().mockResolvedValue([pendingDomain]);
    addSiteDomainMock.mockReset().mockResolvedValue(pendingDomain);
    copyMock.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      writable: true,
      value: { writeText: async () => undefined },
    });
    vi.spyOn(window.navigator.clipboard, "writeText").mockImplementation(copyMock);
  });

  it("muestra instrucciones DNS copiables para dominios pendientes", async () => {
    const user = userEvent.setup();
    renderScreen();

    const table = await screen.findByRole("table", { name: "Dominios propios" });
    within(table).getByText("academia.test");
    within(table).getByText("_langopia.academia.test");
    within(table).getByText("langopia-domain-verification_token");

    await user.click(screen.getByRole("button", { name: "Copiar registro TXT de academia.test" }));

    expect(txtRecordText(pendingDomain)).toBe(
      "TXT _langopia.academia.test langopia-domain-verification_token",
    );
    screen.getByText("Registro TXT copiado.");
  });

  it("permite añadir un dominio y refresca el listado", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.type(screen.getByLabelText("Dominio"), "Academia.TEST");
    await user.click(screen.getByRole("button", { name: "Añadir dominio" }));

    await waitFor(() => expect(addSiteDomainMock).toHaveBeenCalled());
    expect(addSiteDomainMock.mock.calls[0]?.[0]).toBe("Academia.TEST");
    expect(listSiteDomainsMock).toHaveBeenCalledTimes(2);
  });
});
