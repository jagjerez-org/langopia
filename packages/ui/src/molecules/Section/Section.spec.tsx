import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Section } from "./Section.js";

describe("Section", () => {
  it("renderiza la cabecera expandida por defecto con el contenido visible", () => {
    render(
      <Section title="Detalles del documento">
        <p>Contenido de la sección.</p>
      </Section>,
    );

    const trigger = screen.getByRole("button", { name: "Detalles del documento" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Contenido de la sección.")).toBeDefined();
  });

  it("alterna la expansión al pulsar y conecta aria-controls con el contenido", async () => {
    const user = userEvent.setup();
    render(
      <Section title="Detalles del documento">
        <p>Contenido de la sección.</p>
      </Section>,
    );

    const trigger = screen.getByRole("button", { name: "Detalles del documento" });
    const content = screen.getByText("Contenido de la sección.").parentElement!;
    expect(trigger.getAttribute("aria-controls")).toBe(content.getAttribute("id"));

    await user.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(content.hasAttribute("hidden")).toBe(true);

    await user.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(content.hasAttribute("hidden")).toBe(false);
  });

  it("respeta defaultExpanded=false en modo no controlado", () => {
    render(
      <Section title="Detalles del documento" defaultExpanded={false}>
        <p>Contenido de la sección.</p>
      </Section>,
    );

    expect(screen.getByRole("button", { name: "Detalles del documento" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("en modo controlado no cambia solo, pero avisa con onToggle", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <Section title="Detalles del documento" expanded onToggle={onToggle}>
        <p>Contenido de la sección.</p>
      </Section>,
    );

    const trigger = screen.getByRole("button", { name: "Detalles del documento" });
    await user.click(trigger);
    expect(onToggle).toHaveBeenCalledWith(false);
    // Sigue expandida: el estado lo posee quien llama.
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("renderiza los tags junto al título", () => {
    render(
      <Section title="Detalles del documento" tags={[{ label: "3 pendientes", variant: "warning" }]}>
        <p>Contenido.</p>
      </Section>,
    );

    expect(screen.getByText("3 pendientes")).toBeDefined();
  });
});
