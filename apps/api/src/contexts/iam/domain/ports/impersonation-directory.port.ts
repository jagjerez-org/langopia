/** Impersonación activa en la que una credencial es quien impersona (no el objetivo). */
export type ActiveImpersonationRow = {
  impersonationId: string;
  schoolId: string;
  targetMembershipId: string;
  targetRole: string;
  /** Idioma por defecto de la escuela de destino: para fijar `CLS_LOCALE` como en cualquier otra petición. */
  targetSchoolLocale: string | null;
  /**
   * Slug y estado de la escuela de destino. Los pide `SessionTenantGuard`
   * para aplicarle a la impersonación el MISMO filtro de estado que a
   * cualquier otra sesión (`SCHOOL_STATUSES_THAT_ALLOW_ACCESS`): una escuela
   * `canceled` no admite accesos, tampoco por esta puerta.
   */
  targetSchoolSlug: string;
  targetSchoolStatus: string;
  impersonatorMembershipId: string | null;
  reason: string;
  involvesMinor: boolean;
  expiresAt: Date;
};

/**
 * Preguntas sobre impersonación que hay que responder ANTES de que exista
 * tenant, exactamente igual que `MembershipLookupPort` resuelve a qué
 * escuelas pertenece una credencial antes de fijar ninguna.
 *
 * Las cuatro se apoyan en funciones `SECURITY DEFINER` del fichero de
 * políticas del paquete de datos (`is_platform_support`,
 * `school_id_for_membership`, `active_impersonation_for_impersonator`,
 * `is_being_impersonated`): sin tenant fijado, RLS dejaría vacía cualquiera
 * de estas consultas si se hicieran contra las tablas directamente.
 */
export interface ImpersonationDirectoryPort {
  /** ¿Esta credencial es soporte de la plataforma? */
  isPlatformSupport(authUserId: string): Promise<boolean>;

  /** A qué escuela pertenece una membresía cualquiera. `null` si no existe. */
  schoolIdForMembership(membershipId: string): Promise<string | null>;

  /**
   * La impersonación activa en la que esta credencial es quien impersona,
   * si la hay. Se usa dos veces: sobre quien inicia (para impedir apilar) y
   * sobre la credencial de la PERSONA A IMPERSONAR (para impedir impersonar
   * a alguien que a su vez está impersonando a un tercero).
   */
  activeAsImpersonator(authUserId: string): Promise<ActiveImpersonationRow | null>;

  /** ¿Esta credencial está siendo impersonada por otra persona ahora mismo? */
  isBeingImpersonated(authUserId: string): Promise<boolean>;
}

export const IMPERSONATION_DIRECTORY = Symbol("ImpersonationDirectoryPort");
