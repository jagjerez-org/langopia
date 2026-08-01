import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, it, vi } from "vitest";
import type { LeadFunnelView } from "./api.js";

const { listLeadsMock } = vi.hoisted(() => ({ listLeadsMock: vi.fn() }));

vi.mock("./api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api.js")>();
  return { ...actual, listLeads: listLeadsMock };
});

const { LeadsFunnelScreen } = await import("./LeadsFunnelScreen.js");

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LeadsFunnelScreen />
    </QueryClientProvider>,
  );
}

const leads: LeadFunnelView[] = [
  {
    id: "lead-1",
    name: "Ana García",
    email: "ana@example.com",
    phone: "+34 600 000 000",
    status: "placement_done",
    interestedLanguage: "en",
    declaredLevel: "A2",
    placementLevel: "B1",
    placementScore: 72,
    sourcePage: "/contacto",
    sourceCampaign: "google-ads-verano",
    createdAt: "2026-07-28T10:00:00.000Z",
    lastContactedAt: null,
  },
  {
    id: "lead-2",
    name: "Luis Soto",
    email: "luis@example.com",
    phone: null,
    status: "cold",
    interestedLanguage: "fr",
    declaredLevel: null,
    placementLevel: null,
    placementScore: null,
    sourcePage: "/",
    sourceCampaign: null,
    createdAt: "2026-06-20T10:00:00.000Z",
    lastContactedAt: null,
  },
];

describe("LeadsFunnelScreen", () => {
  beforeEach(() => {
    listLeadsMock.mockReset().mockResolvedValue(leads);
  });

  it("pinta métricas de embudo y candidatos con origen y nivelación", async () => {
    renderScreen();

    await screen.findByRole("heading", { name: "Embudo de matrícula" });
    await screen.findByText("2 candidatos");
    screen.getByText("1 con prueba hecha");
    screen.getByText("1 frío");

    const table = screen.getByRole("table", { name: "Candidatos del embudo" });
    within(table).getByText("Ana García");
    within(table).getByText("Prueba hecha");
    within(table).getByText("A2 → B1");
    within(table).getByText("/contacto · google-ads-verano");
  });
});
