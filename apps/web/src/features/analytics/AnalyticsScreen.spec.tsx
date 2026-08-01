import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api-client.js";
import type {
  McpAuthorizationView,
  NpsView,
  StudentAtRiskView,
  TeacherProductivityView,
  TeacherQualityView,
} from "./api.js";

const {
  getNpsMock,
  getTeacherQualityMock,
  getTeacherProductivityMock,
  getStudentsAtRiskMock,
  listMcpAuthorizationsMock,
  revokeMcpAuthorizationMock,
} = vi.hoisted(() => ({
  getNpsMock: vi.fn(),
  getTeacherQualityMock: vi.fn(),
  getTeacherProductivityMock: vi.fn(),
  getStudentsAtRiskMock: vi.fn(),
  listMcpAuthorizationsMock: vi.fn(),
  revokeMcpAuthorizationMock: vi.fn(),
}));

vi.mock("./api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api.js")>();
  return {
    ...actual,
    getNps: getNpsMock,
    getTeacherQuality: getTeacherQualityMock,
    getTeacherProductivity: getTeacherProductivityMock,
    getStudentsAtRisk: getStudentsAtRiskMock,
    listMcpAuthorizations: listMcpAuthorizationsMock,
    revokeMcpAuthorization: revokeMcpAuthorizationMock,
  };
});

const { AnalyticsScreen } = await import("./AnalyticsScreen.js");

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AnalyticsScreen />
    </QueryClientProvider>,
  );
}

const nps: NpsView = { score: 42, respondents: 31, promoters: 18, passives: 8, detractors: 5 };
const quality: TeacherQualityView[] = [
  { teacherProfileId: "teacher-1", teacherName: "Dan Whitfield", responses: 11, averageCsat: 4.2, negativeReviewsPending: 1 },
];
const risk: StudentAtRiskView[] = [
  {
    studentId: "student-1",
    name: "Lucía Ferrán",
    level: "high",
    score: 9,
    reasons: ["low_attendance", "consecutive_absences", "stale_evaluation"],
    signals: {
      attendanceRateLast4Weeks: 0.33,
      consecutiveAbsences: 3,
      weeksWithoutEvaluation: 4,
      lastProgressRating: 2,
      recentNegativeReviewRating: null,
      hasPastDueInvoice: false,
      latestNpsScore: 6,
    },
  },
];
const productivity: TeacherProductivityView[] = [
  {
    teacherProfileId: "teacher-1",
    teacherName: "Dan Whitfield",
    scheduledHours: 18,
    contractedHours: 20,
    occupancyRate: 0.9,
    sessionCount: 9,
    studentsWithoutEvaluation: 2,
    studentsWithoutEvaluationNames: ["Nerea Ojeda", "Lucía Ferrán"],
    averageCsat: 4.2,
    csatResponses: 11,
    materialReviews: 5,
    averageMaterialReview: 3.8,
    pendingNegativeMaterialReviews: 1,
    lateStartedSessions: 2,
    completedSessions: 8,
    unsignedCorrectionsOlderThan7Days: 3,
  },
];
const authorizations: McpAuthorizationView[] = [
  {
    authorizationId: "auth-1",
    clientName: "Claude Desktop",
    clientKind: "claude",
    memberName: "Marta Colomer",
    scopes: ["students:read", "analytics:read"],
    status: "active",
    createdAt: "2026-07-21T10:00:00.000Z",
    expiresAt: "2026-07-28T10:00:00.000Z",
    lastUsedAt: "2026-07-27T10:00:00.000Z",
  },
];

describe("AnalyticsScreen (Ola 3, Tarea 10)", () => {
  beforeEach(() => {
    getNpsMock.mockReset().mockResolvedValue(nps);
    getTeacherQualityMock.mockReset().mockResolvedValue(quality);
    getTeacherProductivityMock.mockReset().mockResolvedValue(productivity);
    getStudentsAtRiskMock.mockReset().mockResolvedValue(risk);
    listMcpAuthorizationsMock.mockReset().mockResolvedValue(authorizations);
    revokeMcpAuthorizationMock.mockReset().mockResolvedValue({ revoked: true });
  });

  it("pinta satisfacción, alumnos en riesgo con motivos, productividad y clientes MCP", async () => {
    renderScreen();

    await screen.findByRole("heading", { name: "Analítica" });
    screen.getByText("NPS");
    await screen.findByText("42");
    screen.getByText("CSAT medio");
    screen.getByText("Dan Whitfield");

    const riskTable = screen.getByRole("table", { name: "Alumnos en riesgo" });
    within(riskTable).getByText("Lucía Ferrán");
    within(riskTable).getByText("Asistencia baja");
    within(riskTable).getByText("3 faltas seguidas");
    within(riskTable).getByText("4 semanas sin valoración");

    const productivityTable = screen.getByRole("table", { name: "Productividad docente" });
    within(productivityTable).getByText("90 %");
    within(productivityTable).getByText("Nerea Ojeda, Lucía Ferrán");

    const mcpTable = screen.getByRole("table", { name: "Clientes MCP" });
    within(mcpTable).getByText("Claude Desktop");
    within(mcpTable).getByText("students:read, analytics:read");
  });

  it("revoca un cliente MCP y refresca el listado", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "Revocar Claude Desktop" }));

    await waitFor(() => expect(revokeMcpAuthorizationMock).toHaveBeenCalledWith("auth-1"));
    expect(listMcpAuthorizationsMock).toHaveBeenCalledTimes(2);
    screen.getByText("Cliente MCP revocado.");
  });

  it("muestra un error traducido si falla una consulta", async () => {
    getStudentsAtRiskMock.mockRejectedValue(
      new ApiError({ code: "insufficient_role", title: "Prohibido", status: 403, params: { required: "owner" } }),
    );

    renderScreen();

    await screen.findByRole("alert");
    screen.getByText("Esta acción requiere el rol owner.");
  });
});
