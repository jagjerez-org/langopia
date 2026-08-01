export type MembershipRow = {
  membershipId: string;
  schoolId: string;
  schoolSlug: string;
  /**
   * Idioma por defecto de la escuela. Opcional porque la regla de resolución no
   * lo mira: quien decide el tenant solo necesita el slug. Lo rellena el
   * repositorio para que quien lo necesite no vuelva a preguntar a la base de
   * datos por algo que ya viajaba en la misma consulta.
   */
  schoolLocale?: string | null;
  /**
   * Estado de la escuela: `trial`, `active`, `past_due` o `canceled`. Decide si
   * se puede entrar; la regla está en `SCHOOL_STATUSES_THAT_ALLOW_ACCESS`.
   */
  schoolStatus: string;
  role: string;
};

export const MEMBERSHIP_LOOKUP = Symbol("MembershipLookupPort");

export interface MembershipLookupPort {
  /**
   * Membresías activas de una persona, en todas sus escuelas.
   *
   * Se pregunta por el identificador de la credencial de Better Auth
   * (`session.user.id`), no por el correo: el puente con `users` es
   * `users.auth_user_id`, una columna que la persona no elige ni puede
   * cambiar. Preguntando por correo, registrarse con el de un dueño era
   * heredar su escuela; por identificador no hay nada que adivinar. El valor
   * llega de una sesión ya verificada, nunca del cliente.
   *
   * Es la única lectura del sistema que ocurre fuera del `UnitOfWork`, porque
   * es la que averigua QUÉ tenant hay que fijar: dentro de la transacción, RLS
   * la dejaría vacía y no se podría iniciar sesión.
   *
   * Devuelve una fila por membresía, no por escuela: quien tiene dos roles en
   * la misma escuela aparece dos veces. Agruparlas es tarea de `resolveTenant`.
   * Sin ninguna fila —credencial recién registrada, o persona del dominio a la
   * que nadie ha atado todavía una credencial— no se entra en ningún sitio.
   */
  activeFor(authUserId: string): Promise<MembershipRow[]>;
}
