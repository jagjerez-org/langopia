import { api } from "../../lib/api-client.js";
import type { TeacherOccupancyView } from "@langopia/contracts";

// `TeacherOccupancyView` (con la `signal` ya calculada por la API) viene de
// `@langopia/contracts`, tal como ya la tipa `GetTeacherOccupancyHandler`
// (`apps/api/.../scheduling/application/queries/get-teacher-occupancy/`):
// una sola definición para los dos lados.
export type { TeacherOccupancyView } from "@langopia/contracts";

/**
 * Formas de `GET /dashboard/summary` (contexto `portal`, commit `95ff985`,
 * `GetDashboardSummaryHandler`). El contexto `portal` no publica un paquete
 * de contratos compartido como `scheduling` — igual que `BetterAuthSession`
 * en `features/auth/api.ts`, se declaran aquí, junto a quien las consume.
 */
export type AtRiskReason = "low_attendance" | "no_recent_evaluation";

export type AtRiskStudent = {
  studentId: string;
  name: string;
  /** 0 a 1, últimas cuatro semanas. `null` si no tuvo ninguna clase en el periodo. */
  attendanceRate: number | null;
  /** `null` si nunca se le ha hecho una valoración de progreso. */
  weeksSinceLastEvaluation: number | null;
  reasons: AtRiskReason[];
};

export type DashboardSummary = {
  activeStudents: number;
  averageAttendanceRate: number;
  /** Siempre `null` hasta que exista el contexto `feedback` (ola 3): no hay encuestas todavía. */
  nps: null;
  invoicedThisMonth: { amountCents: number; currency: string };
  studentsRequiringAttention: AtRiskStudent[];
};

/**
 * Misma clave de consulta para `IndicatorsRow` y `AtRiskStudentsTable`: las
 * dos pintan trozos distintos de la MISMA respuesta (`GET
 * /dashboard/summary` la trae junta, ver `GetDashboardSummaryHandler`), así
 * que comparten caché en vez de repetir la petición — TanStack Query
 * deduplica por igualdad de la clave, no hace falta subir el estado a un
 * padre común.
 */
export const DASHBOARD_SUMMARY_QUERY_KEY = ["dashboard", "summary"] as const;

export function getDashboardSummary(): Promise<DashboardSummary> {
  return api.get<DashboardSummary>("/dashboard/summary");
}

/**
 * `GET /scheduling/teacher-occupancy?from=...&to=...` (`DateRangeDto`, ISO
 * 8601). El panel elige la ventana (`currentWeekRange`, Paso 5); la
 * clasificación (`signal`, con sus umbrales de sobrecarga e
 * infrautilización) la sigue calculando la API, no este cliente.
 */
export function getTeacherOccupancy(range: {
  from: string;
  to: string;
}): Promise<TeacherOccupancyView[]> {
  const query = new URLSearchParams(range);
  return api.get<TeacherOccupancyView[]>(`/scheduling/teacher-occupancy?${query.toString()}`);
}
