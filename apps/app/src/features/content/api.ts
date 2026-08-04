import type { SchoolTimezone } from "@langopia/contracts";
import { api } from "../../lib/api-client.js";
import type {
  ContentUnitDetail,
  ContentUnitListItem,
  GenerateUnitInput,
  GenerateUnitResult,
  GenerationEstimate,
  PublishTarget,
  PublishUnitResult,
  UpdateExerciseResult,
} from "./types.js";

/**
 * Cliente HTTP del generador de contenido (Tarea 11 de la ola 2), sobre el
 * cliente compartido (`apps/app/src/lib/api-client.ts`): mismo manejo de
 * errores tipados, misma cabecera `Accept-Language`, misma `x-school-slug`.
 *
 * Sin lógica propia: cada función traduce uno a uno un endpoint de
 * `UnitsController` (`@Roles("owner", "admin", "teacher")`). Ni una decisión
 * de negocio aquí — ni siquiera si hay saldo, que llega resuelta en
 * `GenerationEstimate.wouldBeRejected`.
 */

export function listUnits(status?: string): Promise<ContentUnitListItem[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return api.get<ContentUnitListItem[]>(`/learning/units${query}`);
}

export function getGenerationEstimate(): Promise<GenerationEstimate> {
  return api.get<GenerationEstimate>("/learning/units/generation-estimate");
}

export function getUnitDetail(contentUnitId: string): Promise<ContentUnitDetail> {
  return api.get<ContentUnitDetail>(`/learning/units/${contentUnitId}`);
}

export function generateUnit(input: GenerateUnitInput): Promise<GenerateUnitResult> {
  return api.post<GenerateUnitResult>("/learning/units/generate", input);
}

export function updateExercise(
  contentUnitId: string,
  exerciseId: string,
  body: { prompt: Record<string, unknown>; solution?: Record<string, unknown> },
): Promise<UpdateExerciseResult> {
  return api.patch<UpdateExerciseResult>(
    `/learning/units/${contentUnitId}/exercises/${exerciseId}`,
    body,
  );
}

/**
 * Grupos a los que se puede publicar la unidad (Paso 4 del brief:
 * «publicar a grupos, con selector múltiple»). La elegibilidad la decide la
 * API; este cliente no filtra nada por su cuenta.
 */
export function listPublishTargets(contentUnitId: string): Promise<PublishTarget[]> {
  return api.get<PublishTarget[]>(`/learning/units/${contentUnitId}/publish-targets`);
}

/** Sin `groupIds`, publica igual que antes del Paso 4 (cuerpo opcional). */
export function publishUnit(contentUnitId: string, groupIds?: string[]): Promise<PublishUnitResult> {
  return api.post<PublishUnitResult>(
    `/learning/units/${contentUnitId}/publish`,
    groupIds && groupIds.length > 0 ? { groupIds } : {},
  );
}

/**
 * Zona horaria de la escuela (`GET /scheduling/school-timezone`, Tarea 9 del
 * panel): las fechas de las unidades se pintan en la zona de la ESCUELA,
 * nunca en la del navegador de quien mira la pantalla.
 */
export function getSchoolTimezone(): Promise<SchoolTimezone> {
  return api.get<SchoolTimezone>("/scheduling/school-timezone");
}
