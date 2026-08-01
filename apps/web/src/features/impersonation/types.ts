/**
 * Tipos del cliente para la impersonación de soporte (Tarea 17).
 *
 * `apps/web` todavía no existe como aplicación montada en este monorepo —
 * ver la nota en el informe de la tarea—, así que estos ficheros no los
 * compila ni los prueba nada todavía. Están aquí para que quien monte el
 * panel (Vite + React, según `ARCHITECTURE.md`) tenga ya resuelto el
 * contrato con la API y no reinvente la forma de los datos.
 */

/** Lo que devuelve `GET /api/v1/iam/impersonation`. `null` si no hay ninguna activa. */
export interface ActiveImpersonation {
  impersonationId: string;
  targetMembershipId: string;
  targetName: string;
  impersonatorName: string;
  impersonatorEmail: string;
  reason: string;
  involvesMinor: boolean;
  startedAt: string;
  expiresAt: string;
}

/** Una fila de `GET /api/v1/iam/impersonation/history` (paso 12 del brief). */
export interface ImpersonationAuditEntry {
  impersonationId: string;
  targetMembershipId: string;
  targetName: string;
  targetRole: string;
  impersonatorName: string;
  impersonatorEmail: string;
  reason: string;
  involvesMinor: boolean;
  startedAt: string;
  endedAt: string | null;
  expiresAt: string;
  durationSeconds: number | null;
}
