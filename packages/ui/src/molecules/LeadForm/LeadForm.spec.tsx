import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LeadForm } from "./LeadForm.js";

const consentLabel = (
  <span>
    Acepto la <a href="/privacidad">política de privacidad</a>.
  </span>
);

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Nombre/), "Ana Pérez");
  await user.type(screen.getByLabelText(/Correo electrónico/), "ana@academia.com");
  await user.click(screen.getByRole("switch"));
}

describe("LeadForm", () => {
  it("renderiza todos los campos y el consentimiento con su enlace", () => {
    render(<LeadForm onSubmit={() => {}} consentLabel={consentLabel} />);

    expect(screen.getByLabelText(/Nombre/).tagName).toBe("INPUT");
    expect(screen.getByLabelText(/Correo electrónico/).tagName).toBe("INPUT");
    expect(screen.getByLabelText(/Teléfono/).tagName).toBe("INPUT");
    expect(screen.getByLabelText(/Mensaje/).tagName).toBe("TEXTAREA");
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("link", { name: "política de privacidad" }).getAttribute("href")).toBe(
      "/privacidad",
    );
  });

  it("el envío vacío muestra errores en nombre, correo y consentimiento", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<LeadForm onSubmit={onSubmit} consentLabel={consentLabel} />);
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findAllByRole("alert")).toHaveLength(3);
    expect(screen.getByText("El nombre es obligatorio.")).toBeDefined();
    expect(screen.getByText("Introduce un correo electrónico válido.")).toBeDefined();
    expect(screen.getByText("Debes aceptar la política de privacidad.")).toBeDefined();
    expect(screen.getByRole("switch").getAttribute("aria-invalid")).toBe("true");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("sin consentimiento no se envía aunque el resto sea válido", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<LeadForm onSubmit={onSubmit} consentLabel={consentLabel} />);
    await user.type(screen.getByLabelText(/Nombre/), "Ana Pérez");
    await user.type(screen.getByLabelText(/Correo electrónico/), "ana@academia.com");
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findAllByRole("alert")).toHaveLength(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("con los campos obligatorios cubiertos llama a onSubmit con los datos", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<LeadForm onSubmit={onSubmit} consentLabel={consentLabel} />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        name: "Ana Pérez",
        email: "ana@academia.com",
        phone: "",
        message: "",
        consent: true,
      }),
    );
  });

  it("incluye teléfono y mensaje cuando se rellenan", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<LeadForm onSubmit={onSubmit} consentLabel={consentLabel} />);
    await fillValidForm(user);
    await user.type(screen.getByLabelText(/Teléfono/), "600123123");
    await user.type(screen.getByLabelText(/Mensaje/), "Quiero información de los cursos.");
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ phone: "600123123", message: "Quiero información de los cursos." }),
      ),
    );
  });

  it("muestra el error de servidor por prop y al rechazar la promesa", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error("El CRM no responde."));

    const { rerender } = render(<LeadForm onSubmit={onSubmit} consentLabel={consentLabel} />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect((await screen.findByRole("alert")).textContent).toBe("El CRM no responde.");

    rerender(<LeadForm onSubmit={onSubmit} consentLabel={consentLabel} error="Error externo." />);
    expect(screen.getByRole("alert").textContent).toBe("Error externo.");
  });

  it("durante el envío deshabilita campos y consentimiento", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(() => new Promise<void>(() => {}));

    render(<LeadForm onSubmit={onSubmit} consentLabel={consentLabel} />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Enviar" }).getAttribute("aria-busy")).toBe("true"),
    );
    expect((screen.getByLabelText(/Nombre/) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("switch") as HTMLButtonElement).disabled).toBe(true);
  });
});
