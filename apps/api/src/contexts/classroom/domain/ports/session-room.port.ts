import type { RoomProvider } from "../model/room-provider.js";

export interface SessionRoomSnapshot {
  readonly sessionId: string;
  readonly schoolId: string;
  readonly provider: RoomProvider;
  readonly url: string | null;
  readonly externalId: string | null;
}

/**
 * Lo que `classroom` necesita leer y escribir de la clase que originó la
 * sala: `sessions.room_url` y `sessions.room_external_id`, que vive en el
 * contexto `scheduling`.
 *
 * `classroom` no importa el repositorio de `scheduling` ni su agregado —
 * cruzar así la frontera invertiría la dependencia (ver ARCHITECTURE.md,
 * «superficie pública de un contexto»)—. Este puerto expone solo lo que hace
 * falta: consultar el aula de una sesión y guardar la que se acaba de crear.
 * Lo implementa un repositorio propio de `classroom` en
 * `infrastructure/persistence/`, igual que `DrizzleSchoolDirectoryRepository`
 * ya lee la tabla `schools` sin pertenecer a su contexto.
 */
export interface SessionRoomPort {
  find(sessionId: string): Promise<SessionRoomSnapshot | null>;

  attachRoom(params: {
    sessionId: string;
    url: string | null;
    externalId: string | null;
  }): Promise<void>;
}

export const SESSION_ROOM_PORT = Symbol("SessionRoomPort");
