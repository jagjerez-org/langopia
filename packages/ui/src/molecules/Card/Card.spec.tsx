import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Card } from "./Card.js";
import { cardActions, cardImage, cardTags } from "../../fixtures/cards.js";

describe("Card", () => {
  it("renderiza título, contenido, tags e imagen con su alt", () => {
    render(
      <Card title="Guía de estilo" image={cardImage} tags={cardTags}>
        <p>Resumen del documento.</p>
      </Card>,
    );

    expect(screen.getByText("Guía de estilo")).toBeDefined();
    expect(screen.getByText("Resumen del documento.")).toBeDefined();
    expect(screen.getByText("Nuevo")).toBeDefined();
    expect(screen.getByAltText("Paisaje de montañas al amanecer")).toBeDefined();
  });

  it("con acciones renderiza el pie con botones y enlaces", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <Card title="Guía de estilo" actions={[{ label: "Guardar", onClick: onSave }, { label: "Abrir", href: "/guia" }]}>
        <p>Resumen.</p>
      </Card>,
    );

    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "Abrir" }).getAttribute("href")).toBe("/guia");
  });

  it("con href la tarjeta entera es un enlace", () => {
    render(
      <Card title="Guía de estilo" href="/guia">
        <p>Resumen.</p>
      </Card>,
    );

    expect(screen.getByRole("link", { name: /Guía de estilo/ }).getAttribute("href")).toBe("/guia");
  });

  it("con onClick la tarjeta entera es un botón", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Card title="Guía de estilo" onClick={onClick}>
        <p>Resumen.</p>
      </Card>,
    );

    await user.click(screen.getByRole("button", { name: /Guía de estilo/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("con acciones y onClick, la zona clickable es el cuerpo y el pie queda fuera", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onSave = vi.fn();
    render(
      <Card
        title="Guía de estilo"
        onClick={onOpen}
        actions={[{ label: "Guardar", onClick: onSave }]}
      >
        <p>Resumen.</p>
      </Card>,
    );

    const bodyButton = screen.getByRole("button", { name: /Resumen/ });
    const footerButton = screen.getByRole("button", { name: "Guardar" });
    expect(bodyButton.contains(footerButton)).toBe(false);

    await user.click(footerButton);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("admite orientación horizontal", () => {
    const { container } = render(
      <Card title="Guía de estilo" image={cardImage} orientation="horizontal">
        <p>Resumen.</p>
      </Card>,
    );

    expect(container.firstElementChild?.getAttribute("data-orientation")).toBe("horizontal");
  });

  it("usa las acciones del fixture", () => {
    render(<Card title="Guía de estilo" actions={cardActions} />);

    expect(screen.getByRole("button", { name: "Guardar" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Abrir" })).toBeDefined();
  });
});
