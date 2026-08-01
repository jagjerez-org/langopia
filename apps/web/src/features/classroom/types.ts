/**
 * Tipos del cliente para la Tarea 11 (Aula del profesor), sobre
 * `POST /classroom/sessions/:id/join`.
 */

/** Estado de grabación/transcripción de la clase, tal como lo decidió el servidor (Paso 4 del brief). */
export type RecordingConsentStatus = {
  blocked: boolean;
  blockedReason: string | null;
};

/** Respuesta de `POST /classroom/sessions/:id/join`. */
export type ClassroomJoinResult = {
  token: string;
  url: string;
  expiresAt: string;
  recording: RecordingConsentStatus;
};
