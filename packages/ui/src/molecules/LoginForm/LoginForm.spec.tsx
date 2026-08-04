import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./LoginForm.js";

describe("LoginForm", () => {
  it("renderiza los campos, el botón de envío y usa noValidate", () => {
    render(<LoginForm onSubmit={() => {}} />);

    expect(screen.getByLabelText(/Correo electrónico/).getAttribute("type")).toBe("email");
    expect(screen.getByLabelText(/Contraseña/).getAttribute("type")).toBe("password");
    expect(screen.getByRole("button", { name: "Entrar" }).getAttribute("type")).toBe("submit");
    expect(document.querySelector("form")?.hasAttribute("noValidate")).toBe(true);
  });

  it("el envío vacío muestra errores por campo y no llama a onSubmit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<LoginForm onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findAllByRole("alert")).toHaveLength(2);
    expect(screen.getByText("Introduce un correo electrónico válido.")).toBeDefined();
    expect(screen.getByText("La contraseña debe tener al menos 8 caracteres.")).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("respeta la longitud mínima de contraseña configurable", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<LoginForm onSubmit={onSubmit} minPasswordLength={4} />);
    await user.type(screen.getByLabelText(/Correo electrónico/), "ana@academia.com");
    await user.type(screen.getByLabelText(/Contraseña/), "abcd");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it("con datos válidos llama a onSubmit con los valores", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<LoginForm onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/Correo electrónico/), "ana@academia.com");
    await user.type(screen.getByLabelText(/Contraseña/), "super-secreta");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        email: "ana@academia.com",
        password: "super-secreta",
      }),
    );
  });

  it("muestra el error de servidor recibido por prop con role=alert", () => {
    render(<LoginForm onSubmit={() => {}} error="Credenciales incorrectas." />);

    expect(screen.getByRole("alert").textContent).toBe("Credenciales incorrectas.");
  });

  it("si la promesa de onSubmit rechaza, muestra su mensaje como error de servidor", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error("La cuenta está bloqueada."));

    render(<LoginForm onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/Correo electrónico/), "ana@academia.com");
    await user.type(screen.getByLabelText(/Contraseña/), "super-secreta");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect((await screen.findByRole("alert")).textContent).toBe("La cuenta está bloqueada.");
  });

  it("si la promesa rechaza sin mensaje, usa el texto de reserva", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error(""));

    render(<LoginForm onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/Correo electrónico/), "ana@academia.com");
    await user.type(screen.getByLabelText(/Contraseña/), "super-secreta");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "No se pudo iniciar sesión. Inténtalo de nuevo.",
    );
  });

  it("durante el envío deshabilita los campos y marca el botón como cargando", async () => {
    const user = userEvent.setup();
    let resolveSubmit: (() => void) | undefined;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );

    render(<LoginForm onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/Correo electrónico/), "ana@academia.com");
    await user.type(screen.getByLabelText(/Contraseña/), "super-secreta");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Entrar" }).getAttribute("aria-busy")).toBe("true"),
    );
    expect((screen.getByLabelText(/Correo electrónico/) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText(/Contraseña/) as HTMLInputElement).disabled).toBe(true);

    resolveSubmit?.();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Entrar" }).hasAttribute("aria-busy")).toBe(false),
    );
  });

  it("muestra el enlace de recuperación solo cuando hay href", () => {
    const { rerender } = render(<LoginForm onSubmit={() => {}} />);

    expect(screen.queryByRole("link")).toBeNull();

    rerender(<LoginForm onSubmit={() => {}} forgotPasswordHref="/recuperar" />);

    const link = screen.getByRole("link", { name: "¿Olvidaste tu contraseña?" });
    expect(link.getAttribute("href")).toBe("/recuperar");
  });
});
