/**
 * Quién hizo la acción: distingue una persona de un proceso automático.
 *
 * `impersonation` (Tarea 17) es soporte de la plataforma o un `owner`/`admin`
 * actuando como otra persona de su escuela. No lo fija quien llama a
 * `record()` — lo hace la propia implementación del puerto, a partir del
 * `TenantContext` de la petición, ver `DrizzleAuditLogRepository`.
 */
export type AuditActorKind = "user" | "system" | "mcp" | "webhook" | "impersonation";

export type AuditLogEntry = {
  schoolId: string;
  actorKind: AuditActorKind;
  /** Ausente en trabajos de sistema: no hay membresía detrás de un cron. */
  actorMembershipId?: string | null;
  /**
   * Quién era DE VERDAD, si esta acción ocurrió mientras alguien impersonaba
   * a `actorMembershipId`. Casi nunca hace falta pasarlo a mano: la
   * implementación del puerto lo rellena sola con
   * `TenantContext.impersonatorMembershipId()` cuando hay una impersonación
   * activa, así que un caso de uso que no sepa nada de impersonación sigue
   * dejando el rastro completo sin cambiar una línea. Solo lo pasan a mano
   * los propios comandos de impersonación (`StartImpersonationHandler`,
   * `EndImpersonationHandler`), que escriben su auditoría ANTES de que exista
   * el contexto de tenant que lo detectaría solo.
   */
  impersonatorMembershipId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  /** Cliente MCP que originó la acción, si vino de Claude, ChatGPT u otro cliente registrado. */
  mcpClientId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

/**
 * Registro de auditoría, append-only.
 *
 * Cualquier caso de uso que necesite dejar constancia de qué pasó —quién,
 * qué acción, sobre qué entidad— pide este puerto. `actorKind` es lo que
 * permite que una auditoría RGPD responda «¿fue una persona o un proceso
 * automático quien tocó esto?».
 */
export interface AuditLogPort {
  record(entry: AuditLogEntry): Promise<void>;
}

export const AUDIT_LOG = Symbol("AuditLogPort");
