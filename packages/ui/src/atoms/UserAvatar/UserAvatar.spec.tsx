import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { UserAvatar } from "./UserAvatar.js";

describe("UserAvatar", () => {
  it("sin imagen muestra las iniciales del nombre (máximo dos, en mayúsculas)", () => {
    render(<UserAvatar name="maría pilar sanchís" />);

    const avatar = screen.getByRole("img", { name: "maría pilar sanchís" });
    expect(avatar.textContent).toBe("MP");
  });

  it("con una sola palabra muestra una única inicial", () => {
    render(<UserAvatar name="Andrea" />);

    expect(screen.getByRole("img", { name: "Andrea" }).textContent).toBe("A");
  });

  it("con src renderiza la imagen con alt vacío (el nombre lo da el contenedor)", () => {
    render(<UserAvatar name="Andrea Gil" src="/avatars/andrea.png" />);

    const image = screen.getByRole("img", { name: "Andrea Gil" }).querySelector("img")!;
    expect(image.getAttribute("src")).toBe("/avatars/andrea.png");
    expect(image.getAttribute("alt")).toBe("");
  });

  it("si la imagen falla al cargar cae a las iniciales", () => {
    render(<UserAvatar name="Andrea Gil" src="/rota.png" />);

    const avatar = screen.getByRole("img", { name: "Andrea Gil" });
    fireEvent.error(avatar.querySelector("img")!);

    expect(avatar.querySelector("img")).toBeNull();
    expect(avatar.textContent).toBe("AG");
  });

  it("expone data-size según la prop", () => {
    render(<UserAvatar name="Andrea Gil" size="lg" />);

    expect(screen.getByRole("img", { name: "Andrea Gil" }).getAttribute("data-size")).toBe("lg");
  });

  it("usa el tamaño md por defecto", () => {
    render(<UserAvatar name="Andrea Gil" />);

    expect(screen.getByRole("img", { name: "Andrea Gil" }).getAttribute("data-size")).toBe("md");
  });

  it("reenvía la ref al elemento span", () => {
    const ref = createRef<HTMLSpanElement>();

    render(<UserAvatar ref={ref} name="Andrea Gil" />);

    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });
});
