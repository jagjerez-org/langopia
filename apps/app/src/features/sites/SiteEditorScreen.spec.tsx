import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EditableSite } from "./api.js";

const { getEditableSiteMock, saveSitePageBlocksMock, publishSiteMock, unpublishSiteMock } = vi.hoisted(() => ({
  getEditableSiteMock: vi.fn(),
  saveSitePageBlocksMock: vi.fn(),
  publishSiteMock: vi.fn(),
  unpublishSiteMock: vi.fn(),
}));

vi.mock("./api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api.js")>();
  return {
    ...actual,
    getEditableSite: getEditableSiteMock,
    saveSitePageBlocks: saveSitePageBlocksMock,
    publishSite: publishSiteMock,
    unpublishSite: unpublishSiteMock,
  };
});

const { SiteEditorScreen } = await import("./SiteEditorScreen.js");

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SiteEditorScreen />
    </QueryClientProvider>,
  );
}

const editableSite: EditableSite = {
  site: {
    id: "site-1",
    status: "draft",
    primaryLocale: "es-ES",
    theme: {},
    previewUrl: "http://localhost:4321/?draft=site-1",
  },
  locales: ["es-ES", "en-GB"],
  teacherOptions: [
    { teacherId: "teacher-1", displayName: "Ana", imageUrl: null, imageRights: true },
    { teacherId: "teacher-2", displayName: "Bruno", imageUrl: null, imageRights: false },
  ],
  pages: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      slug: "",
      title: "Inicio",
      locale: "es-ES",
      isHome: true,
      published: false,
      blocks: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          type: "hero",
          props: {
            headline: "Aprende inglés",
            subtitle: "Grupos reducidos",
            image: { url: "/hero.webp", alt: "Clase" },
            callToAction: { label: "Contactar", href: "/contacto" },
          },
        },
        {
          id: "33333333-3333-4333-8333-333333333333",
          type: "contact",
          props: { title: "Hablemos", submitLabel: "Enviar", leadSource: "school_site" },
        },
      ],
    },
  ],
};

describe("SiteEditorScreen", () => {
  beforeEach(() => {
    getEditableSiteMock.mockReset().mockResolvedValue(editableSite);
    saveSitePageBlocksMock.mockReset().mockResolvedValue(editableSite.pages[0]);
    publishSiteMock.mockReset().mockResolvedValue({ ...editableSite.site, status: "published" });
    unpublishSiteMock.mockReset().mockResolvedValue({ ...editableSite.site, status: "unpublished" });
    vi.stubGlobal("crypto", { randomUUID: () => "44444444-4444-4444-8444-444444444444" });
  });

  it("muestra selector de idioma, bloques y preview con token de borrador", async () => {
    renderScreen();

    await screen.findByRole("heading", { name: "Editor web" });
    screen.getByLabelText("Idioma");
    screen.getByLabelText("Página");
    screen.getByDisplayValue("Aprende inglés");
    expect(screen.getByTitle("Vista previa").getAttribute("src")).toBe("http://localhost:4321/?draft=site-1");
  });

  it("reordena bloques y guarda la página editable", async () => {
    const user = userEvent.setup();
    renderScreen();

    const sections = await screen.findAllByRole("heading", { level: 2 });
    expect(sections.map((section) => section.textContent)).toEqual(["Hero", "Contacto"]);

    await user.click(screen.getAllByRole("button", { name: "Mover bloque arriba" })[1]!);
    await user.click(screen.getByRole("button", { name: "Guardar bloques" }));

    await waitFor(() => expect(saveSitePageBlocksMock).toHaveBeenCalled());
    expect(saveSitePageBlocksMock.mock.calls[0]?.[0]).toBe("11111111-1111-4111-8111-111111111111");
    expect(saveSitePageBlocksMock.mock.calls[0]?.[1].map((block: { type: string }) => block.type)).toEqual([
      "contact",
      "hero",
    ]);
  });

  it("publica y despublica de forma explícita", async () => {
    const user = userEvent.setup();
    renderScreen();

    await screen.findByRole("heading", { name: "Editor web" });
    await user.click(screen.getByRole("button", { name: "Publicar" }));
    await user.click(screen.getByRole("button", { name: "Despublicar" }));

    expect(publishSiteMock).toHaveBeenCalled();
    expect(unpublishSiteMock).toHaveBeenCalled();
  });

  it("avisa al añadir profesorado sin derechos de imagen", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.selectOptions(await screen.findByLabelText("Añadir bloque"), "teachers");
    const blockSection = screen.getByRole("heading", { name: "Profesorado" }).closest("li");
    expect(blockSection).not.toBeNull();

    const teacherArea = within(blockSection as HTMLElement);
    await user.click(teacherArea.getByLabelText(/Bruno/));

    teacherArea.getByText("Sin derechos de imagen: no aparecerá en la web pública.");
  });
});
