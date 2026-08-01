/**
 * Quién cobra a quién. Mismos valores que `invoice_direction` en Postgres
 * (`enums-match-db.spec.ts` lo comprueba).
 */
export const InvoiceDirection = {
  /** Tu suscripción a la escuela. Nunca lleva comisión. */
  PlatformToSchool: "platform_to_school",
  /** La escuela cobra a un alumno vía su propio proveedor de pago. */
  SchoolToStudent: "school_to_student",
} as const;

export type InvoiceDirection = (typeof InvoiceDirection)[keyof typeof InvoiceDirection];
