import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "./ThemeToggle.js";

const labels = { light: "Claro", dark: "Oscuro" } as const;

describe("ThemeToggle", () => {
  it("renderiza el modo claro con aria-pressed=false", () => {
    render(<ThemeToggle value="light" onChange={() => {}} labels={labels} />);

    const button = screen.getByRole("button");

    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.getAttribute("aria-label")).toBe(labels.light);
    expect(button.textContent).toContain(labels.light);
    expect(button.textContent).toContain(labels.dark);
  });

  it("renderiza el modo oscuro con aria-pressed=true", () => {
    render(<ThemeToggle value="dark" onChange={() => {}} labels={labels} />);

    const button = screen.getByRole("button");

    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.getAttribute("aria-label")).toBe(labels.dark);
  });

  it("invierte el tema y notifica onChange al hacer click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<ThemeToggle value="light" onChange={onChange} labels={labels} />);

    await user.click(screen.getByRole("button"));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("dark");
  });

  it("desde oscuro invierte a claro", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<ThemeToggle value="dark" onChange={onChange} labels={labels} />);

    await user.click(screen.getByRole("button"));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("light");
  });
});
