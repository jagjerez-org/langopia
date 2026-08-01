import type { SchoolTimezone } from "@langopia/contracts";
import { api } from "../../lib/api-client.js";
import type { ActiveImpersonation, ActiveImpersonationResponse, ImpersonationAuditEntry } from "./types.js";

/**
 * Cliente HTTP para la impersonación, ahora sobre el cliente compartido
 * (`apps/web/src/lib/api-client.ts`, Tarea 2): mismo manejo de `code` de
 * error, misma cabecera `Accept-Language`, misma redirección en
 * `missing_tenant`. Tal como anotaba el informe de la Tarea 2 («se
 * reescriben para usarlo en cuanto exista»), y ahora existe porque esta
 * tarea (3) es la que monta el marco de la aplicación donde vive el aviso
 * permanente de impersonación.
 */

export async function startImpersonation(params: {
  targetMembershipId: string;
  reason: string;
}): Promise<ActiveImpersonation> {
  return api.post<ActiveImpersonation>("/iam/impersonation", params);
}

export async function endImpersonation(): Promise<void> {
  await api.delete<void>("/iam/impersonation");
}

export async function getActiveImpersonation(): Promise<ActiveImpersonation | null> {
  const response = await api.get<ActiveImpersonationResponse>("/iam/impersonation");
  return response.active;
}

export async function listImpersonationHistory(): Promise<ImpersonationAuditEntry[]> {
  return api.get<ImpersonationAuditEntry[]>("/iam/impersonation/history");
}

/**
 * Zona horaria de la escuela activa (`GET /scheduling/school-timezone`):
 * inicio y fin de una impersonación son instantes de verdad y se pintan en
 * la zona de la escuela, nunca en la del navegador. Se declara aquí en vez
 * de importar el `api.ts` de `calendar` o `billing`: cada pantalla declara
 * su propio cliente sobre el mismo endpoint, como ya hacen esas dos.
 */
export async function getSchoolTimezone(): Promise<SchoolTimezone> {
  return api.get<SchoolTimezone>("/scheduling/school-timezone");
}
