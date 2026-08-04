import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../lib/api-client.js";
import { ToastProvider } from "@langopia/ui";
import { createTestRouter } from "../test-router.testsupport.js";
import type { UploadMaterialResult } from "./types.js";

const { uploadMaterialMock, createUnitFromMaterialMock, getGenerationEstimateMock } = vi.hoisted(
  () => ({
    uploadMaterialMock: vi.fn(),
    createUnitFromMaterialMock: vi.fn(),
    getGenerationEstimateMock: vi.fn(),
  }),
);

vi.mock("./api.js", () => ({
  uploadMaterial: uploadMaterialMock,
  createUnitFromMaterial: createUnitFromMaterialMock,
}));

// La pantalla pide la estimación solo para saber QUÉ TIPOS puede ofrecer: la
// lista la decide la API (`unavailableExerciseTypes`), no este componente.
vi.mock("../api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api.js")>();
  return { ...actual, getGenerationEstimate: getGenerationEstimateMock };
});

const { UploadMaterialScreen } = await import("./UploadMaterialScreen.js");

/** El router monta de forma asíncrona: hasta que resuelve la ruta no hay nada en el DOM. */
async function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createTestRouter("/contenido/subir", [
    { path: "/contenido/subir", component: UploadMaterialScreen },
    { path: "/contenido", component: () => <></> },
    { path: "/contenido/$contentUnitId", component: () => <></> },
  ]);
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider label="Avisos" closeLabel="Cerrar aviso">
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  await screen.findByRole("heading", { name: "Subir material propio" });
  return rendered;
}

const PDF_INDEXADO: UploadMaterialResult = {
  materialId: "11111111-1111-4111-8111-111111111111",
  format: "pdf",
  bytes: 4096,
  indexed: true,
};

const MP3_SIN_INDEXAR: UploadMaterialResult = {
  materialId: "22222222-2222-4222-8222-222222222222",
  format: "mp3",
  bytes: 2048,
  indexed: false,
};

function ficheroPdf(nombre = "cuaderno-b1.pdf"): File {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], nombre, {
    type: "application/pdf",
  });
}

describe("UploadMaterialScreen (Tarea 14 de la ola 2, Paso 7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getGenerationEstimateMock.mockResolvedValue({
      estimatedCredits: 40,
      currentBalance: 644,
      hardLimit: true,
      wouldBeRejected: false,
      unavailableExerciseTypes: ["dictation", "shadowing", "listening_comprehension"],
    });
  });

  it("estado vacío: sin ficheros todavía, lo dice en vez de enseñar una lista en blanco", async () => {
    await renderScreen();

    screen.getByText("Todavía no has subido ningún fichero.");
    screen.getByText(/Formatos admitidos: PDF, DOCX, MP3, WAV, MP4, JPG, PNG/);
    // Regla del brief que el usuario tiene que ver, no deducir.
    screen.getByText("Subir material no consume créditos. Solo generar consume.");
  });

  it("sube el fichero elegido y enseña que quedó subido e indexado", async () => {
    uploadMaterialMock.mockResolvedValue(PDF_INDEXADO);
    const user = userEvent.setup();
    await renderScreen();

    await user.upload(screen.getByLabelText("Elegir ficheros del disco"), ficheroPdf());

    await screen.findByText("Subido");
    screen.getByText("Indexado");
    expect(uploadMaterialMock).toHaveBeenCalledTimes(1);
    expect((uploadMaterialMock.mock.calls[0]![0] as File).name).toBe("cuaderno-b1.pdf");
  });

  it("mientras sube, enseña el progreso que reporta el navegador", async () => {
    let reportar: ((percent: number) => void) | undefined;
    uploadMaterialMock.mockImplementation(
      (_file: File, onProgress: (percent: number) => void) =>
        new Promise<UploadMaterialResult>((resolve) => {
          reportar = (percent) => {
            onProgress(percent);
            if (percent === 100) resolve(PDF_INDEXADO);
          };
        }),
    );
    const user = userEvent.setup();
    await renderScreen();

    await user.upload(screen.getByLabelText("Elegir ficheros del disco"), ficheroPdf());

    const barra = (await screen.findByLabelText(
      "Progreso de subida de cuaderno-b1.pdf",
    )) as HTMLProgressElement;
    expect(barra.value).toBe(0);

    reportar!(42);
    await waitFor(() => {
      expect(
        (screen.getByLabelText("Progreso de subida de cuaderno-b1.pdf") as HTMLProgressElement).value,
      ).toBe(42);
    });

    reportar!(100);
    await screen.findByText("Subido");
  });

  it("arrastrar y soltar un formato que la API rechaza enseña su mensaje, con la lista de formatos válidos", async () => {
    // Por la puerta de soltar, no por el selector: `accept` filtra en el
    // diálogo nativo, así que un fichero no admitido solo puede llegar
    // arrastrándolo — que es justo el caso que el rechazo del servidor tiene
    // que cubrir, porque esta pantalla no valida nada por su cuenta.
    uploadMaterialMock.mockRejectedValue(
      new ApiError({
        code: "unsupported_material_format",
        title:
          "«apuntes.key» no tiene un formato admitido. Formatos válidos: PDF, DOCX, MP3, WAV, MP4, JPG, PNG.",
        status: 400,
        params: { declaredFilename: "apuntes.key" },
      }),
    );
    await renderScreen();

    const zona = screen.getByRole("button", {
      name: "Arrastra ficheros aquí o pulsa para elegirlos",
    });
    fireEvent.drop(zona, {
      dataTransfer: { files: [new File(["x"], "apuntes.key", { type: "application/octet-stream" })] },
    });

    const aviso = await screen.findByRole("alert");
    expect(aviso.textContent).toContain("Formatos válidos");
    expect(uploadMaterialMock).toHaveBeenCalledTimes(1);
  });

  it("un material sin indexar no ofrece generar una unidad, y explica por qué", async () => {
    uploadMaterialMock.mockResolvedValue(MP3_SIN_INDEXAR);
    const user = userEvent.setup();
    await renderScreen();

    await user.upload(
      screen.getByLabelText("Elegir ficheros del disco"),
      new File(["x"], "clase.mp3", { type: "audio/mpeg" }),
    );

    await screen.findByText("Sin indexar");
    screen.getByText(/Solo se indexan PDF y DOCX/);
    expect(screen.queryByRole("button", { name: "Generar unidad del material" })).toBeNull();
  });

  it("genera una unidad a partir del material indexado, con los campos que exige la API", async () => {
    uploadMaterialMock.mockResolvedValue(PDF_INDEXADO);
    createUnitFromMaterialMock.mockResolvedValue({
      contentUnitId: "33333333-3333-4333-8333-333333333333",
      status: "in_review",
      materialId: PDF_INDEXADO.materialId,
      chunksUsed: 3,
    });
    const user = userEvent.setup();
    await renderScreen();

    await user.upload(screen.getByLabelText("Elegir ficheros del disco"), ficheroPdf());
    await screen.findByText("Indexado");

    await user.type(screen.getByLabelText(/Código de la unidad/), "ES-B1-U20");
    await user.type(screen.getByLabelText(/^Tema/), "En la consulta del médico");
    await user.click(screen.getByLabelText("Vocabulario"));
    await user.click(screen.getByLabelText("Huecos"));
    await user.click(screen.getByRole("button", { name: "Generar unidad del material" }));

    await waitFor(() => expect(createUnitFromMaterialMock).toHaveBeenCalledTimes(1));
    expect(createUnitFromMaterialMock.mock.calls[0]![0]).toMatchObject({
      materialId: PDF_INDEXADO.materialId,
      code: "ES-B1-U20",
      topic: "En la consulta del médico",
      skills: ["vocabulary"],
      exerciseTypes: ["cloze"],
    });
    await screen.findByText("Ver la unidad generada");
  });

  it("no deja generar sin los campos obligatorios: el botón está deshabilitado", async () => {
    uploadMaterialMock.mockResolvedValue(PDF_INDEXADO);
    const user = userEvent.setup();
    await renderScreen();

    await user.upload(screen.getByLabelText("Elegir ficheros del disco"), ficheroPdf());
    await screen.findByText("Indexado");

    expect(
      (screen.getByRole("button", { name: "Generar unidad del material" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("los tipos que la API marca como no disponibles salen deshabilitados, sin lista propia", async () => {
    uploadMaterialMock.mockResolvedValue(PDF_INDEXADO);
    const user = userEvent.setup();
    await renderScreen();

    await user.upload(screen.getByLabelText("Elegir ficheros del disco"), ficheroPdf());
    await screen.findByText("Indexado");

    await waitFor(() => {
      expect((screen.getByLabelText(/Dictado/) as HTMLInputElement).disabled).toBe(true);
    });
    expect((screen.getByLabelText("Huecos") as HTMLInputElement).disabled).toBe(false);
  });

  it("la zona de soltar se alcanza con el teclado: es un botón de verdad", async () => {
    await renderScreen();

    const zona = screen.getByRole("button", {
      name: "Arrastra ficheros aquí o pulsa para elegirlos",
    });
    zona.focus();
    expect(document.activeElement).toBe(zona);
  });
});
