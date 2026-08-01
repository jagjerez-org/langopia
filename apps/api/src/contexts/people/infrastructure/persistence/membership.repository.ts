import type { ProvisionedRole } from "../../domain/ports/membership-provisioning.port.js";

export const MEMBERSHIP_REPOSITORY = Symbol("MembershipRepository");

/**
 * Lo que el adaptador anticorrupción de `people` necesita para aprovisionar
 * personas en `users` y `memberships`. Vive aquí, y no en el dominio, porque
 * habla de esas dos tablas concretas.
 */
export interface MembershipRepository {
  /** El usuario es global: la misma persona puede estar en dos escuelas. */
  upsertUser(params: { email: string; name: string; locale: string }): Promise<string>;

  /**
   * La membresía es por escuela y rol. Reactivar en lugar de duplicar cubre
   * el caso del tutor con dos hijos matriculados: una sola membresía, dos
   * vínculos.
   */
  upsertMembership(params: {
    schoolId: string;
    userId: string;
    role: ProvisionedRole;
    locale: string | null;
  }): Promise<string>;
}
