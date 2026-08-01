import { DomainError } from "../../../shared/domain/errors/domain-error.js";
import type { MembershipRoleName } from "./invitation.aggregate.js";

/**
 * Nadie se impersona a sí mismo. No aporta nada y ensucia la auditoría.
 */
export class CannotImpersonateSelfError extends DomainError {
  readonly code = "cannot_impersonate_self";
  readonly kind = "forbidden" as const;
  constructor() {
    super("No puedes impersonarte a ti mismo.");
  }
}

/**
 * Sin encadenar. Cubre las dos direcciones: quien inicia ya está siendo
 * impersonado por otro, o a quien se quiere impersonar está a su vez
 * impersonando a un tercero. Las dos rompen lo mismo: dejan de poder
 * responder a «¿quién hizo esto de verdad?».
 */
export class ImpersonationChainError extends DomainError {
  readonly code = "impersonation_chain_forbidden";
  readonly kind = "forbidden" as const;
  constructor() {
    super("No se puede encadenar una impersonación.");
  }
}

/** Quien inicia ya tiene una impersonación activa: hay que terminarla antes de abrir otra. */
export class ImpersonationAlreadyActiveError extends DomainError {
  readonly code = "impersonation_already_active";
  readonly kind = "conflict" as const;
  constructor() {
    super("Ya tienes una impersonación activa. Termínala antes de iniciar otra.");
  }
}

/**
 * Ni hacia arriba ni en horizontal, y nadie fuera de `owner`/`admin`/soporte
 * de plataforma impersona a nadie. Un único código para las tres ramas —
 * mismo criterio que `invalid_school_slug`: son frases distintas y ninguna
 * necesita un parámetro para tener sentido.
 */
export class ImpersonationNotAllowedError extends DomainError {
  readonly code = "impersonation_not_allowed";
  readonly kind = "forbidden" as const;
  constructor() {
    super("No puedes impersonar a esa persona.");
  }
}

/**
 * Jerarquía de roles dentro de una escuela, del más alto al más bajo. Es la
 * regla de negocio («nunca hacia arriba ni en horizontal») expresada como
 * números para poder compararla con un simple `>`: quien impersona necesita
 * un rango ESTRICTAMENTE mayor que el de a quien impersona. `teacher`,
 * `student` y `guardian` comparten rango porque son horizontales entre sí —
 * ninguno impersona a otro— y porque ninguno impersona a nadie en absoluto,
 * lo que la comparación estricta ya garantiza sin una rama aparte.
 */
const ROLE_RANK: Record<MembershipRoleName, number> = {
  owner: 3,
  admin: 2,
  teacher: 1,
  student: 1,
  guardian: 1,
};

/**
 * Quien inicia la impersonación.
 *
 * `kind: "platform_support"` es soporte de la plataforma: puede actuar como
 * cualquier miembro de cualquier escuela (tabla del brief, fila 1), así que
 * no lleva `roles` que comparar. `kind: "membership"` es `owner`/`admin`/
 * `teacher`/`student`/`guardian` de una escuela: `roles` son SUS roles en la
 * MISMA escuela que la persona a la que quiere impersonar (vacío si no
 * pertenece a esa escuela en absoluto).
 */
export interface ImpersonationActorInput {
  readonly kind: "platform_support" | "membership";
  /** Su propia membresía en la escuela de destino, si la tiene. */
  readonly membershipId: string | null;
  readonly roles: readonly MembershipRoleName[];
  /** ¿Ya tiene abierta OTRA impersonación? No se apilan. */
  readonly isCurrentlyImpersonating: boolean;
  /** ¿Alguien más le está impersonando A ÉL ahora mismo? */
  readonly isCurrentlyBeingImpersonated: boolean;
}

/** A quién se quiere impersonar. */
export interface ImpersonationTargetInput {
  readonly membershipId: string;
  readonly role: MembershipRoleName;
  /** ¿Esta persona está, a su vez, impersonando a alguien ahora mismo? */
  readonly isCurrentlyImpersonatingSomeoneElse: boolean;
}

/**
 * Decide si `actor` puede impersonar a `target`. No devuelve un booleano:
 * lanza el error concreto, porque cada rechazo tiene un código y un mensaje
 * distintos que la auditoría y el cliente necesitan distinguir.
 *
 * Orden de las comprobaciones, deliberado: primero uno mismo (el caso más
 * barato y más obvio), luego el estado de quien inicia, luego el de a quién
 * apunta, y solo al final la jerarquía de roles — que es la única rama que
 * necesita mirar `kind`.
 */
export function assertCanImpersonate(
  actor: ImpersonationActorInput,
  target: ImpersonationTargetInput,
): void {
  if (actor.membershipId !== null && actor.membershipId === target.membershipId) {
    throw new CannotImpersonateSelfError();
  }

  if (actor.isCurrentlyImpersonating) throw new ImpersonationAlreadyActiveError();
  if (actor.isCurrentlyBeingImpersonated) throw new ImpersonationChainError();
  if (target.isCurrentlyImpersonatingSomeoneElse) throw new ImpersonationChainError();

  if (actor.kind === "platform_support") return;

  if (actor.roles.length === 0) throw new ImpersonationNotAllowedError();

  const actorRank = Math.max(...actor.roles.map((role) => ROLE_RANK[role]));
  const targetRank = ROLE_RANK[target.role];
  if (actorRank <= targetRank) throw new ImpersonationNotAllowedError();
}

/**
 * Acciones prohibidas mientras se impersona. Vive aquí, cerrada, y no
 * repartida por los controladores: cada endpoint que la necesite importa
 * uno de estos valores para el decorador `RestrictedWhileImpersonating`
 * (`shared/infrastructure/http/roles.decorator.ts`) en vez de escribir su
 * propia cadena. Que un endpoint nuevo nazca sin protección es justo lo que
 * esto evita — nunca puede pasarle desapercibido a quien lo escribe, porque
 * el tipo no admite otra cosa que uno de estos seis valores.
 */
export const FORBIDDEN_WHILE_IMPERSONATING = [
  /** Contraseña, correo o segundo factor: es secuestro de la cuenta, no soporte. */
  "credential_change",
  /** Borrar la cuenta o la escuela: irreversible y ajeno. */
  "account_deletion",
  /** Cobrar, devolver o cambiar datos de pago: dinero real de otra persona. */
  "payment_operation",
  /** Exportar o borrar datos (RGPD): convierte el soporte en una vía de exfiltración. */
  "data_export_or_erasure",
  /** Otorgar o retirar consentimientos: los firma el tutor, nadie más. */
  "consent_management",
  /** Conceder o quitar roles: escalada por la puerta de atrás. */
  "role_management",
] as const;

export type ForbiddenImpersonationAction = (typeof FORBIDDEN_WHILE_IMPERSONATING)[number];
