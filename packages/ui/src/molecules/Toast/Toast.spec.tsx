import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider } from "./Toast.js";
import { useToast } from "./toast-context.js";
import type { ToastOptions } from "./toast-context.js";

/** Botón que dispara un aviso a través del hook, como haría cualquier pantalla. */
function Disparador({ options }: { options: ToastOptions }) {
  const { showToast } = useToast();
  return (
    <button type="button" onClick={() => showToast(options)}>
      Avisar
    </button>
  );
}

function renderToast(options: ToastOptions) {
  return render(
    <ToastProvider label="Avisos" closeLabel="Cerrar aviso">
      <Disparador options={options} />
    </ToastProvider>,
  );
}

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("muestra el aviso en la región nombrada, con rol status por defecto", () => {
    renderToast({ title: "Material subido" });

    fireEvent.click(screen.getByRole("button", { name: "Avisar" }));

    const region = screen.getByRole("region", { name: "Avisos" });
    const status = screen.getByRole("status");

    expect(region.contains(status)).toBe(true);
    expect(status.textContent).toContain("Material subido");
  });

  it("la variante critical usa rol alert y no se descarta sola", () => {
    renderToast({ variant: "critical", title: "No se pudo guardar" });

    fireEvent.click(screen.getByRole("button", { name: "Avisar" }));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByRole("alert").textContent).toContain("No se pudo guardar");
  });

  it("los avisos no críticos se descartan solos a los 6 segundos", () => {
    renderToast({ variant: "success", title: "Cambios guardados" });

    fireEvent.click(screen.getByRole("button", { name: "Avisar" }));
    expect(screen.getByRole("status")).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(6_000);
    });

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("el botón de cerrar descarta el aviso", () => {
    renderToast({ title: "Material subido" });

    fireEvent.click(screen.getByRole("button", { name: "Avisar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar aviso" }));

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("tener el puntero encima pausa el descarte automático", () => {
    renderToast({ title: "Material subido" });

    fireEvent.click(screen.getByRole("button", { name: "Avisar" }));
    const toast = screen.getByRole("status");

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    fireEvent.mouseEnter(toast);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByRole("status")).toBeDefined();

    fireEvent.mouseLeave(toast);
    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("pinta la descripción cuando se pasa", () => {
    renderToast({ title: "Error", description: "traceId: abc-123" });

    fireEvent.click(screen.getByRole("button", { name: "Avisar" }));

    expect(screen.getByText("traceId: abc-123")).toBeDefined();
  });

  it("useToast fuera del provider lanza un error explícito", () => {
    // Se silencia el log de React para no ensuciar la salida del test.
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<Disparador options={{ title: "x" }} />)).toThrow(
      "useToast debe usarse dentro de <ToastProvider>.",
    );

    consola.mockRestore();
  });
});
