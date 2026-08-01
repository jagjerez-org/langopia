/**
 * Datos crudos de una posible destinataria, tal cual los trae un adaptador de
 * lectura desde `memberships`/`users`. No es un agregado: notifications no
 * posee esta identidad, solo la lee para decidir a quién y en qué idioma
 * escribir.
 */
export interface RecipientCandidate {
  membershipId: string;
  email: string;
  name: string;
  /** `memberships.locale`. NULL si esta persona no fijó uno para esta escuela. */
  membershipLocale: string | null;
  /** `users.locale`. Siempre tiene valor: la columna no admite NULL. */
  userLocale: string;
}

/** Un tutor, con el dato que decide si es él quien recibe el correo del menor. */
export interface GuardianCandidate extends RecipientCandidate {
  isBillingContact: boolean;
}

/** A quién escribir, y en qué idioma. Lo único que necesita `MailerPort.send()`. */
export interface Recipient {
  email: string;
  name: string;
  locale: string;
}
