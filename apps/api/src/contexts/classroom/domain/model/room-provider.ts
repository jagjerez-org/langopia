/**
 * Proveedor de vídeo de una clase.
 *
 * Mismos valores que `RoomProvider` en `scheduling` (y que el `pgEnum`
 * `room_provider` de `packages/db`): `scheduling` es dueño del concepto de
 * aula de una clase, pero `classroom` no puede importar su tipo sin cruzar la
 * frontera del contexto — `architecture.spec.ts` solo deja importar
 * `domain/events/` de otro contexto. Se redeclara aquí, igual que cualquier
 * conjunto cerrado que dos contextos necesitan sin poder compartir el módulo
 * que lo declara (ver ARCHITECTURE.md, «nada de literales sueltos»).
 */
export const RoomProvider = {
  LiveKit: "livekit", // aula propia
  Zoom: "zoom",
  GoogleMeet: "google_meet",
  MsTeams: "ms_teams",
  InPerson: "in_person",
} as const;

export type RoomProvider = (typeof RoomProvider)[keyof typeof RoomProvider];
