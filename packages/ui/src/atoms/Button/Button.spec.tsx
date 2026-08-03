import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { Button } from "./Button.js";

describe("Button", () => {
  it("renderiza el texto y aplica variante y tamaño por defecto", () => {
    render(<Button>Guardar</Button>);

    const button = screen.getByRole("button", { name: "Guardar" });

    expect(button.getAttribute("data-variant")).toBe("primary");
    expect(button.getAttribute("data-size")).toBe("md");
    expect(button.getAttribute("type")).toBe("button");
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  it("expone data-variant y data-size según las props", () => {
    render(
      <Button variant="danger" size="lg">
        Borrar
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Borrar" });

    expect(button.getAttribute("data-variant")).toBe("danger");
    expect(button.getAttribute("data-size")).toBe("lg");
  });

  it("isLoading fija disabled y aria-busy, mantiene el texto visible", () => {
    render(<Button isLoading>Enviando</Button>);

    const button = screen.getByRole("button", { name: "Enviando" });

    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.textContent).toContain("Enviando");
  });

  it("disabled impide el click", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <Button disabled onClick={onClick}>
        No disponible
      </Button>,
    );

    await user.click(screen.getByRole("button", { name: "No disponible" }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("notifica onClick cuando está habilitado", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<Button onClick={onClick}>Pulsar</Button>);

    await user.click(screen.getByRole("button", { name: "Pulsar" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("acepta type submit para formularios", () => {
    render(<Button type="submit">Enviar</Button>);

    expect(screen.getByRole("button", { name: "Enviar" }).getAttribute("type")).toBe("submit");
  });

  it("renderiza iconos leading y trailing cuando no está cargando", () => {
    render(
      <Button leadingIcon={<span data-testid="lead" />} trailingIcon={<span data-testid="trail" />}>
        Con iconos
      </Button>,
    );

    expect(screen.getByTestId("lead")).toBeDefined();
    expect(screen.getByTestId("trail")).toBeDefined();
  });

  it("en carga sustituye los iconos por el spinner", () => {
    render(
      <Button isLoading leadingIcon={<span data-testid="lead" />}>
        Cargando
      </Button>,
    );

    expect(screen.queryByTestId("lead")).toBeNull();
    expect(document.querySelector(".ink-spin")).not.toBeNull();
  });

  it("reenvía la ref al elemento button", () => {
    const ref = createRef<HTMLButtonElement>();

    render(<Button ref={ref}>Con ref</Button>);

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
