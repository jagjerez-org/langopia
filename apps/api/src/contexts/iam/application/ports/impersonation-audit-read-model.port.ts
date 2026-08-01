export type ImpersonationAuditRow = {
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
  /** `null` mientras sigue activa. */
  durationSeconds: number | null;
};

/**
 * Lado de lectura de la pantalla de auditoría (paso 12 del brief): quién
 * actuó como quién, cuándo, por qué y cuánto duró. Es lo que separa esto de
 * una puerta trasera — que el cliente pueda auditarte.
 */
export interface ImpersonationAuditReadModel {
  listForSchool(limit: number): Promise<ImpersonationAuditRow[]>;
}

export const IMPERSONATION_AUDIT_READ_MODEL = Symbol("ImpersonationAuditReadModel");
