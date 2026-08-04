import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton } from "./Skeleton.js";

describe("Skeleton", () => {
  it("es decorativo: se oculta del árbol de accesibilidad", () => {
    const { container } = render(<Skeleton />);

    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  });

  it("por defecto es un renglón de texto", () => {
    const { container } = render(<Skeleton />);

    const block = container.firstElementChild as HTMLElement;

    expect(block.getAttribute("data-variant")).toBe("text");
  });

  it("con lines > 1 pinta varios renglones bajo un único contenedor oculto", () => {
    const { container } = render(<Skeleton variant="text" lines={4} />);

    const group = container.firstElementChild as HTMLElement;

    expect(group.getAttribute("aria-hidden")).toBe("true");
    expect(group.querySelectorAll("[data-variant='text']")).toHaveLength(4);
  });

  it("las variantes circle y rect se exponen por data-variant", () => {
    const { container } = render(
      <>
        <Skeleton variant="circle" />
        <Skeleton variant="rect" />
      </>,
    );

    expect(container.querySelector("[data-variant='circle']")).not.toBeNull();
    expect(container.querySelector("[data-variant='rect']")).not.toBeNull();
  });

  it("la altura predefinida solo se aplica a la variante rect", () => {
    const { container } = render(
      <>
        <Skeleton variant="rect" height="lg" />
        <Skeleton variant="text" />
      </>,
    );

    expect(container.querySelector("[data-variant='rect']")?.getAttribute("data-height")).toBe("lg");
    expect(container.querySelector("[data-variant='text']")?.hasAttribute("data-height")).toBe(false);
  });
});
