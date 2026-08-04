import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api-client.js";

const { getMerchantStatusMock, startMerchantOnboardingMock } = vi.hoisted(() => ({
  getMerchantStatusMock: vi.fn(),
  startMerchantOnboardingMock: vi.fn(),
}));

vi.mock("./api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api.js")>();
  return {
    ...actual,
    getMerchantStatus: getMerchantStatusMock,
    startMerchantOnboarding: startMerchantOnboardingMock,
  };
});

const { StripeConnectionScreen } = await import("./StripeConnectionScreen.js");

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <StripeConnectionScreen />
    </QueryClientProvider>,
  );
}

describe("StripeConnectionScreen (Tarea 10, Paso 4)", () => {
  beforeEach(() => {
    getMerchantStatusMock.mockReset();
    startMerchantOnboardingMock.mockReset();
  });

  it("deja claro que el producto se puede usar sin conectar, siempre visible", async () => {
    getMerchantStatusMock.mockResolvedValue({
      merchantStatus: "not_started",
      applicationFeeEnabled: false,
      applicationFeeBps: 0,
      applicationFeeCapCents: null,
      currency: "EUR",
    });

    renderScreen();

    screen.getByText("Puedes usar Langopia entero sin conectar");
    await screen.findByText("Sin conectar");
    screen.getByRole("button", { name: "Conectar proveedor de pago" });
  });

  it("con comisión pactada, la enseña; sin ella, dice que no hay ninguna", async () => {
    getMerchantStatusMock.mockResolvedValue({
      merchantStatus: "active",
      applicationFeeEnabled: true,
      applicationFeeBps: 200,
      applicationFeeCapCents: null,
      currency: "EUR",
    });

    renderScreen();

    await screen.findByText("Comisión de plataforma pactada: 2%.");
    screen.getByText("Conectado");
    // Ya conectado: sin acción de conectar.
    expect(screen.queryByRole("button", { name: "Conectar proveedor de pago" })).toBeNull();
  });

  it("una escuela sin comisión (Nordwind: desactivada) lo dice explícitamente", async () => {
    getMerchantStatusMock.mockResolvedValue({
      merchantStatus: "not_started",
      applicationFeeEnabled: false,
      applicationFeeBps: 0,
      applicationFeeCapCents: null,
      currency: "EUR",
    });

    renderScreen();

    await waitFor(() => screen.getByText("Sin comisión de plataforma pactada."));
  });

  it("sin credenciales del proveedor de pago, conectar falla de forma limpia", async () => {
    getMerchantStatusMock.mockResolvedValue({
      merchantStatus: "not_started",
      applicationFeeEnabled: false,
      applicationFeeBps: 0,
      applicationFeeCapCents: null,
      currency: "EUR",
    });
    startMerchantOnboardingMock.mockRejectedValue(
      new ApiError({
        code: "internal_error",
        title: "Ha ocurrido un error inesperado. Inténtalo de nuevo más tarde.",
        status: 500,
      }),
    );
    const user = userEvent.setup();

    renderScreen();

    await screen.findByRole("button", { name: "Conectar proveedor de pago" });
    await user.click(screen.getByRole("button", { name: "Conectar proveedor de pago" }));

    await screen.findByText("Ha ocurrido un error inesperado. Inténtalo de nuevo más tarde.");
  });
});
