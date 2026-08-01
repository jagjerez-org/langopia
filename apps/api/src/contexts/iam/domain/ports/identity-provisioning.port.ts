/**
 * Lo que el alta de escuela y la aceptación de una invitación necesitan de
 * la identidad: encontrar a la persona detrás de una credencial de Better
 * Auth, o crearla si es la primera vez, y darle una membresía.
 *
 * Deliberadamente NO busca por correo (a diferencia de
 * `MembershipProvisioningPort` de `people`, que sí lo hace porque provisiona
 * alumnos y profesores sin credencial propia): aquí la persona SÍ tiene una
 * sesión de Better Auth verificada, y es exactamente el vínculo por correo el
 * que permitía apropiarse de la escuela de otro (ver `tenancy.ts`). El puente
 * es siempre `authUserId`.
 */
export interface IdentityProvisioningPort {
  /**
   * `users.id` ya atado a esta credencial, o `null` si es la primera vez que
   * se registra o acepta algo en el dominio. Se apoya en
   * `user_id_for_auth_user_id`, la función `SECURITY DEFINER` del fichero de
   * políticas del paquete de datos: la política de `users` solo hace visible
   * a una persona con membresía en la escuela ACTUAL, y una escuela recién
   * creada —o una invitación recién aceptada— todavía no tiene ninguna.
   */
  findUserIdByAuthUserId(authUserId: string): Promise<string | null>;

  /** Da de alta a la persona en el dominio. Solo se llama cuando la anterior devolvió `null`. */
  createUser(props: {
    id: string;
    authUserId: string;
    email: string;
    name: string;
    emailVerifiedAt: Date | null;
  }): Promise<void>;

  /** Vínculo persona-escuela-rol. */
  addMembership(props: {
    id: string;
    schoolId: string;
    userId: string;
    role: string;
  }): Promise<void>;
}

export const IDENTITY_PROVISIONING = Symbol("IdentityProvisioningPort");
