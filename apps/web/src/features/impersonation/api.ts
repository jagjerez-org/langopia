import { api } from "../../lib/api-client.js";
import type { ActiveImpersonation, ImpersonationAuditEntry } from "./types.js";

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
  return api.get<ActiveImpersonation | null>("/iam/impersonation");
}

export async function listImpersonationHistory(): Promise<ImpersonationAuditEntry[]> {
  return api.get<ImpersonationAuditEntry[]>("/iam/impersonation/history");
}
