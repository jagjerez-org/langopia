import type { RoomProvider } from "../model/room-provider.js";

export interface CreateRoomRequest {
  readonly sessionId: string;
  readonly schoolId: string;
  readonly provider: RoomProvider;
  readonly start: Date;
  readonly end: Date;
}

/**
 * `created` cuando la sala ya existe en el proveedor y hay enlace al que
 * apuntar. `pending` cuando el proveedor la necesita (Zoom, Meet, Teams) pero
 * la escuela todavía no lo tiene conectado por OAuth: la clase se crea igual
 * — nunca se bloquea por esto — y la sala queda pendiente hasta que se
 * conecte la integración.
 */
export type RoomCreationResult =
  | { readonly status: "created"; readonly url: string; readonly externalId: string | null }
  | { readonly status: "pending"; readonly reason: string };

export interface IssueJoinTokenRequest {
  readonly sessionId: string;
  readonly provider: RoomProvider;
  /** El enlace ya guardado para esta clase. Nunca null: sin él no hay nada a lo que unirse. */
  readonly url: string;
  readonly externalId: string | null;
  /** Quién entra. Nunca se guarda: el token se emite al pedirlo y expira solo. */
  readonly participantId: string;
}

export interface JoinToken {
  readonly token: string;
  readonly url: string;
  readonly expiresAt: Date;
}

export interface DeleteRoomRequest {
  readonly sessionId: string;
  readonly provider: RoomProvider;
  readonly externalId: string | null;
}

/**
 * Lo que `classroom` necesita de cualquier proveedor de vídeo, en su propio
 * lenguaje: crear la sala de una clase, emitir con qué entra alguien y
 * borrarla. Nunca `createMeeting()` ni `application_id`: eso es vocabulario
 * del proveedor, no del negocio (ver ARCHITECTURE.md, «proveedores externos»).
 *
 * Un puerto, cuatro adaptadores (LiveKit, Zoom, Google Meet, Microsoft
 * Teams). El selector que decide cuál usar según `roomProvider` de la clase
 * vive en `infrastructure/external/room-provider.registry.ts`, que implementa
 * este mismo puerto y solo delega.
 */
export interface RoomProviderPort {
  createRoom(request: CreateRoomRequest): Promise<RoomCreationResult>;
  issueJoinToken(request: IssueJoinTokenRequest): Promise<JoinToken>;
  deleteRoom(request: DeleteRoomRequest): Promise<void>;
}

export const ROOM_PROVIDER_PORT = Symbol("RoomProviderPort");
