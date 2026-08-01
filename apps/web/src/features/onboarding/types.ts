/** Estado de la escuela, tal como lo modela `School` en la API (`SchoolStatus`). */
export type SchoolStatus = "trial" | "active" | "past_due" | "canceled";

/** Cuerpo de `POST /auth/sign-up/email` (Better Auth). */
export type SignUpInput = { name: string; email: string; password: string };

/** Cuerpo de `POST /schools/register` (Tarea 11 backend). */
export type RegisterSchoolInput = { slug: string; name: string };
export type RegisterSchoolResult = { schoolId: string; slug: string };

/** `GET /schools/me` (Tarea 12 del panel): ajustes de la escuela activa. */
export type SchoolSettings = {
  name: string;
  defaultLocale: string;
  supportedLocales: string[];
  status: SchoolStatus;
  /** ISO 8601 UTC, o `null` si la escuela ya no está en periodo de prueba. */
  trialEndsAt: string | null;
};

/** Cuerpo de `PATCH /schools/me`: PATCH — un campo ausente no se toca. */
export type UpdateSchoolSettingsInput = { name?: string; defaultLocale?: string };

/** Respuesta de `POST /schools/members/invite`. */
export type InviteMemberResult = { invitationId: string; token: string; expiresAt: string };
