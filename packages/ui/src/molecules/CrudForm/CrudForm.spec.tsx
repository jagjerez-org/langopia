import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CrudForm } from "./CrudForm.js";
import type { CrudField } from "./CrudForm.js";

const fields: CrudField[] = [
  { name: "title", label: "Título", required: true },
  { name: "price", label: "Precio", type: "number", required: true },
  { name: "description", label: "Descripción", type: "textarea" },
  {
    name: "level",
    label: "Nivel",
    type: "select",
    required: true,
    placeholder: "Elige un nivel",
    options: [
      { value: "a1", label: "A1" },
      { value: "b2", label: "B2" },
    ],
  },
  {
    name: "tags",
    label: "Etiquetas",
    type: "multiselect",
    options: [
      { value: "online", label: "Online" },
      { value: "presencial", label: "Presencial" },
    ],
  },
  { name: "published", label: "Publicado", type: "toggle" },
];

describe("CrudForm", () => {
  it("renderiza un control por campo con su etiqueta", () => {
    render(<CrudForm fields={fields} onSubmit={() => {}} />);

    expect(screen.getByLabelText(/Título/).tagName).toBe("INPUT");
    expect(screen.getByLabelText(/Precio/).getAttribute("type")).toBe("number");
    expect(screen.getByLabelText(/Descripción/).tagName).toBe("TEXTAREA");
    expect(screen.getByLabelText(/Nivel/).tagName).toBe("SELECT");
    expect(screen.getByRole("group", { name: "Etiquetas" })).toBeDefined();
    expect(screen.getByRole("switch", { name: "Publicado" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Guardar" }).getAttribute("type")).toBe("submit");
  });

  it("el envío vacío muestra errores solo en los campos obligatorios", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<CrudForm fields={fields} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    const alerts = await screen.findAllByRole("alert");
    expect(alerts).toHaveLength(3);
    expect(alerts.every((alert) => alert.textContent === "Este campo es obligatorio.")).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("transforma los números decimales a number", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <CrudForm
        fields={[{ name: "price", label: "Precio", type: "number", required: true }]}
        onSubmit={onSubmit}
      />,
    );
    await user.type(screen.getByLabelText(/Precio/), "19.9");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ price: 19.9 }),
    );
  });

  it("con datos válidos envía números transformados, arrays y booleanos", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<CrudForm fields={fields} onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/Título/), "Inglés B2 intensivo");
    await user.type(screen.getByLabelText(/Precio/), "240");
    await user.selectOptions(screen.getByLabelText(/Nivel/), "b2");
    await user.click(screen.getByRole("checkbox", { name: "Online" }));
    await user.click(screen.getByRole("switch", { name: "Publicado" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        title: "Inglés B2 intensivo",
        price: 240,
        description: "",
        level: "b2",
        tags: ["online"],
        published: true,
      }),
    );
  });

  it("aplica los defaultValues en modo edición", () => {
    render(
      <CrudForm
        fields={fields}
        defaultValues={{ title: "Curso existente", price: 120, tags: ["presencial"], published: true }}
        onSubmit={() => {}}
      />,
    );

    expect((screen.getByLabelText(/Título/) as HTMLInputElement).value).toBe("Curso existente");
    expect((screen.getByLabelText(/Precio/) as HTMLInputElement).value).toBe("120");
    expect((screen.getByRole("checkbox", { name: "Presencial" }) as HTMLInputElement).checked).toBe(
      true,
    );
    expect(screen.getByRole("switch", { name: "Publicado" }).getAttribute("aria-checked")).toBe(
      "true",
    );
  });

  it("el número opcional vacío se envía como undefined", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <CrudForm
        fields={[{ name: "capacity", label: "Aforo", type: "number" }]}
        onSubmit={onSubmit}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ capacity: undefined }));
  });

  it("muestra el botón de cancelar solo con onCancel y lo invoca al pulsarlo", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    const { rerender } = render(<CrudForm fields={fields} onSubmit={() => {}} />);
    expect(screen.queryByRole("button", { name: "Cancelar" })).toBeNull();

    rerender(<CrudForm fields={fields} onSubmit={() => {}} onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("muestra el error de servidor por prop y al rechazar la promesa", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error("Slug duplicado."));

    const { rerender } = render(
      <CrudForm
        fields={[{ name: "title", label: "Título", required: true }]}
        onSubmit={onSubmit}
      />,
    );
    await user.type(screen.getByLabelText(/Título/), "Nuevo curso");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Slug duplicado.");

    rerender(
      <CrudForm
        fields={[{ name: "title", label: "Título", required: true }]}
        onSubmit={onSubmit}
        error="Error externo."
      />,
    );
    expect(screen.getByRole("alert").textContent).toBe("Error externo.");
  });

  it("durante el envío deshabilita los campos y marca el botón como cargando", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(() => new Promise<void>(() => {}));

    render(
      <CrudForm
        fields={[{ name: "title", label: "Título", required: true }]}
        onSubmit={onSubmit}
      />,
    );
    await user.type(screen.getByLabelText(/Título/), "Nuevo curso");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Guardar" }).getAttribute("aria-busy")).toBe(
        "true",
      ),
    );
    expect((screen.getByLabelText(/Título/) as HTMLInputElement).disabled).toBe(true);
  });

  it("avisa por consola cuando dos campos comparten name y renderiza ambos sin error de keys", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const duplicatedFields: CrudField[] = [
      { name: "title", label: "Título" },
      { name: "title", label: "Título repetido" },
    ];

    render(<CrudForm fields={duplicatedFields} onSubmit={() => {}} />);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("title"));
    expect(screen.getByLabelText("Título")).toBeDefined();
    expect(screen.getByLabelText("Título repetido")).toBeDefined();
    warn.mockRestore();
  });
});
