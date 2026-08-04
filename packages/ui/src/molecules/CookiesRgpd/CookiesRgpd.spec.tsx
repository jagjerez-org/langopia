import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CookiesRgpd } from "./CookiesRgpd.js";

const baseProps = {
  title: "Usamos cookies",
  description: "Utilizamos cookies propias y de terceros para mejorar el servicio.",
  acceptLabel: "Aceptar todas",
  rejectLabel: "Rechazar",
  onAccept: () => {},
  onReject: () => {},
};

describe("CookiesRgpd", () => {
  it("renderiza la región con título y descripción cuando visible", () => {
    render(<CookiesRgpd {...baseProps} visible />);

    const region = screen.getByRole("region", { name: "Aviso de cookies" });
    expect(region).toBeDefined();
    expect(screen.getByText("Usamos cookies")).toBeDefined();
    expect(
      screen.getByText("Utilizamos cookies propias y de terceros para mejorar el servicio."),
    ).toBeDefined();
  });

  it("no renderiza nada cuando visible es false", () => {
    render(<CookiesRgpd {...baseProps} visible={false} />);

    expect(screen.queryByRole("region")).toBeNull();
    expect(screen.queryByText("Usamos cookies")).toBeNull();
  });

  it("permite personalizar el nombre accesible de la región", () => {
    render(<CookiesRgpd {...baseProps} visible ariaLabel="Consentimiento de cookies" />);

    expect(screen.getByRole("region", { name: "Consentimiento de cookies" })).toBeDefined();
  });

  it("los botones de aceptar y rechazar notifican sus callbacks", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    const onReject = vi.fn();

    render(<CookiesRgpd {...baseProps} visible onAccept={onAccept} onReject={onReject} />);

    await user.click(screen.getByRole("button", { name: "Aceptar todas" }));
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onReject).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Rechazar" }));
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it("muestra el botón de configurar solo con etiqueta y callback, y notifica", async () => {
    const user = userEvent.setup();
    const onConfigure = vi.fn();

    const { rerender } = render(<CookiesRgpd {...baseProps} visible />);
    expect(screen.queryByRole("button", { name: "Configurar" })).toBeNull();

    rerender(
      <CookiesRgpd {...baseProps} visible configureLabel="Configurar" onConfigure={onConfigure} />,
    );

    await user.click(screen.getByRole("button", { name: "Configurar" }));
    expect(onConfigure).toHaveBeenCalledTimes(1);
  });

  it("sin onConfigure no hay botón de configurar aunque haya etiqueta", () => {
    render(<CookiesRgpd {...baseProps} visible configureLabel="Configurar" />);

    expect(screen.queryByRole("button", { name: "Configurar" })).toBeNull();
  });

  it("la descripción admite el enlace a la política de cookies", () => {
    render(
      <CookiesRgpd
        {...baseProps}
        visible
        description={
          <>
            Usamos cookies. Más información en nuestra{" "}
            <a href="/legal/cookies">política de cookies</a>.
          </>
        }
      />,
    );

    const link = screen.getByRole("link", { name: "política de cookies" });
    expect(link.getAttribute("href")).toBe("/legal/cookies");
  });
});
