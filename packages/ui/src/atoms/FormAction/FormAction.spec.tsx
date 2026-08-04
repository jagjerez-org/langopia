import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { FormAction } from "./FormAction.js";

describe("FormAction", () => {
  it("sin href es un botón submit por defecto", () => {
    render(<FormAction>Guardar</FormAction>);

    const button = screen.getByRole("button", { name: "Guardar" });

    expect(button.getAttribute("type")).toBe("submit");
    expect(button.getAttribute("data-variant")).toBe("primary");
  });

  it("acepta type=reset", () => {
    render(<FormAction type="reset">Restablecer</FormAction>);

    expect(screen.getByRole("button", { name: "Restablecer" }).getAttribute("type")).toBe("reset");
  });

  it("envía el formulario al hacer click en submit", () => {
    const onSubmit = vi.fn();

    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <FormAction>Enviar</FormAction>
      </form>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("con href renderiza un enlace con el aspecto del botón", () => {
    render(
      <FormAction href="/alumnos" variant="secondary" size="sm">
        Cancelar
      </FormAction>,
    );

    const link = screen.getByRole("link", { name: "Cancelar" });

    expect(link.getAttribute("href")).toBe("/alumnos");
    expect(link.getAttribute("data-variant")).toBe("secondary");
    expect(link.getAttribute("data-size")).toBe("sm");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("isLoading deshabilita el botón y fija aria-busy", () => {
    render(<FormAction isLoading>Guardando</FormAction>);

    const button = screen.getByRole("button", { name: "Guardando" });

    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
  });

  it("en la rama enlace, disabled se comunica con aria-disabled sin atributo disabled", () => {
    render(
      <FormAction href="/alumnos" disabled>
        Volver
      </FormAction>,
    );

    const link = screen.getByRole("link", { name: "Volver" });

    expect(link.hasAttribute("disabled")).toBe(false);
    expect(link.getAttribute("aria-disabled")).toBe("true");
    expect(link.getAttribute("tabindex")).toBe("-1");
  });

  it("en la rama enlace, isLoading muestra el spinner y bloquea la navegación", () => {
    render(
      <FormAction href="/alumnos" isLoading>
        Volver
      </FormAction>,
    );

    const link = screen.getByRole("link", { name: "Volver" });

    expect(link.getAttribute("aria-disabled")).toBe("true");
    expect(link.getAttribute("aria-busy")).toBe("true");
    expect(link.getAttribute("tabindex")).toBe("-1");
    expect(link.querySelector("svg")).not.toBeNull();
  });

  it("reenvía la ref al button o al anchor según el caso", () => {
    const buttonRef = createRef<HTMLButtonElement | HTMLAnchorElement>();
    const linkRef = createRef<HTMLButtonElement | HTMLAnchorElement>();

    render(
      <>
        <FormAction ref={buttonRef}>Botón</FormAction>
        <FormAction ref={linkRef} href="/x">
          Enlace
        </FormAction>
      </>,
    );

    expect(buttonRef.current).toBeInstanceOf(HTMLButtonElement);
    expect(linkRef.current).toBeInstanceOf(HTMLAnchorElement);
  });
});
