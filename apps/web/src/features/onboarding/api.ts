import { api } from "../../lib/api-client.js";
import type {
  InviteMemberResult,
  RegisterSchoolInput,
  RegisterSchoolResult,
  SchoolSettings,
  SignUpInput,
  UpdateSchoolSettingsInput,
} from "./types.js";

/**
 * Cliente HTTP de la Tarea 12 (Registro de escuela y onboarding), sobre el
 * cliente compartido (`apps/web/src/lib/api-client.ts`, Tarea 2): mismo
 * manejo de errores tipados, mismo `Accept-Language`.
 *
 * `signUp` habla con Better Auth directamente (`/auth/*`, igual que
 * `signInWithEmail` en `features/auth/api.ts`): su cuerpo de error no es
 * Problem Details, es el propio de Better Auth (`message`, a veces `code` en
 * SCREAMING_CASE) — el cliente compartido ya cae a `message` cuando falta
 * `title`.
 */

/** `POST /auth/sign-up/email`. Sin sesión resultante mientras el correo no esté verificado —`requireEmailVerification` en `better-auth.config.ts`—, así que la respuesta no trae cookie útil todavía. */
export function signUp(input: SignUpInput): Promise<{ user: { email: string } }> {
  return api.post("/auth/sign-up/email", input);
}

/** `GET /schools/slug-availability`: aviso en vivo, antes de enviar el formulario. */
export function checkSlugAvailability(slug: string): Promise<{ available: boolean }> {
  return api.get(`/schools/slug-availability?slug=${encodeURIComponent(slug)}`);
}

/** `POST /schools/register` (Tarea 11 backend). */
export function registerSchool(input: RegisterSchoolInput): Promise<RegisterSchoolResult> {
  return api.post("/schools/register", input);
}

/** `GET /schools/me`: prellenar el asistente de puesta en marcha y el aviso de días de prueba. */
export function getSchoolSettings(): Promise<SchoolSettings> {
  return api.get("/schools/me");
}

/** `PATCH /schools/me`: pasos "marca" e "idiomas" del asistente. */
export function updateSchoolSettings(input: UpdateSchoolSettingsInput): Promise<SchoolSettings> {
  return api.patch("/schools/me", input);
}

/**
 * Paso "primer profesor" del asistente: invita por correo con rol de
 * profesorado (`POST /schools/members/invite`, ya existente — Tarea 11
 * backend). Sin pantalla propia todavía para aceptar la invitación desde el
 * panel: la persona invitada recibe el enlace por el mismo camino que
 * cualquier invitación (ver el informe de esta tarea).
 */
export function inviteTeacher(email: string): Promise<InviteMemberResult> {
  return api.post("/schools/members/invite", { email, role: "teacher" });
}
