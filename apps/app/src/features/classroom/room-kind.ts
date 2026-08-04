export type RoomKind = "livekit" | "external";

/**
 * De qué tipo es la sala que devolvió `join`, a partir de la FORMA de su
 * propia respuesta — no de una lista de proveedores mantenida a mano en el
 * cliente, que se desincronizaría en cuanto la API añadiera uno nuevo.
 *
 * El aula propia (LiveKit) firma un token distinto del enlace de conexión
 * (`LiveKitRoomAdapter.issueJoinToken`, API): un JWT con sus tres segmentos.
 * Las tres integraciones externas (Zoom, Google Meet, Microsoft Teams) no
 * firman nada propio todavía —no hay OAuth de vídeo conectado (ola 2)—: su
 * "token" es literalmente el mismo enlace al que hay que unirse
 * (`ZoomRoomAdapter`, `GoogleMeetRoomAdapter`, `TeamsRoomAdapter`, API). Esa
 * diferencia observable es la que distingue "aula propia embebida" de
 * "abre este enlace externo", sin que el panel tenga que enumerar
 * proveedores por su nombre.
 */
export function resolveRoomKind(token: string, url: string): RoomKind {
  return token !== url && token.split(".").length === 3 ? "livekit" : "external";
}
