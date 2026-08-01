import type { Impersonation, ImpersonationId } from "../model/impersonation.aggregate.js";
import type { MembershipRoleName } from "../model/invitation.aggregate.js";

/** Lo que hace falta de la membresía a la que se apunta, ya con el tenant fijado. */
export type TargetMembershipInfo = {
  role: MembershipRoleName;
  userId: string;
  /** Credencial de Better Auth de esta persona, o `null` si nunca inició sesión. */
  authUserId: string | null;
  name: string;
};

/**
 * Persistencia del agregado `Impersonation`, dentro de tenant (a diferencia
 * de `ImpersonationDirectoryPort`, que resuelve lo que hace falta ANTES de
 * fijarlo). `findTargetMembership` lee `memberships`/`users` — tablas
 * propias de `iam` — así que es un repositorio normal, no una capa
 * anticorrupción.
 */
export interface ImpersonationRepositoryPort {
  save(impersonation: Impersonation): Promise<void>;
  findById(id: ImpersonationId): Promise<Impersonation | null>;
  /** `null` si la membresía no existe (no debería pasar: ya se resolvió su escuela antes). */
  findTargetMembership(membershipId: string): Promise<TargetMembershipInfo | null>;
}

export const IMPERSONATION_REPOSITORY = Symbol("ImpersonationRepositoryPort");
