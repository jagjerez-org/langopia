import { api } from "../../lib/api-client.js";
import type { ClassroomJoinResult } from "./types.js";

/**
 * Cliente HTTP del aula (Tarea 11), sobre el cliente compartido
 * (`apps/app/src/lib/api-client.ts`). Sin lógica propia: pide el token de la
 * sala construida ya (Tarea 6 de la ola 1, `classroom`); quién puede entrar a
 * cuál lo decide el servidor (`JoinClassroomSessionHandler`), no este cliente.
 */
export function joinSession(sessionId: string): Promise<ClassroomJoinResult> {
  return api.post<ClassroomJoinResult>(`/classroom/sessions/${sessionId}/join`);
}
