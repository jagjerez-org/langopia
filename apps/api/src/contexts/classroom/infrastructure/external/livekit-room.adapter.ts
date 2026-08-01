import { createHmac, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { CLOCK, type Clock } from "../../../shared/domain/ports/clock.port.js";
import type {
  CreateRoomRequest,
  DeleteRoomRequest,
  IssueJoinTokenRequest,
  JoinToken,
  RoomCreationResult,
  RoomProviderPort,
} from "../../domain/ports/room-provider.port.js";

const DEFAULT_BASE_URL = "https://aula.langopia.app";
const DEFAULT_API_KEY = "langopia-dev";
const DEFAULT_API_SECRET = "langopia-dev-secret-do-not-use-in-production";
/** Corta duración a propósito: se emite al pedirlo, nunca se guarda. */
const TOKEN_TTL_SECONDS = 600;

function base64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

/**
 * Firma un JWT HS256 con la forma que espera el cliente de LiveKit (grant de
 * vídeo en `video`), sin depender de su SDK: es una firma HMAC sobre cabecera
 * y payload, y añadir una dependencia entera para eso no se justifica. Si
 * algún día hace falta algo que el SDK ofrezca y esto no —gestión de salas
 * por su API, webhooks firmados—, se sustituye este fichero sin tocar el
 * puerto.
 */
function signHs256(payload: Record<string, unknown>, secret: string): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

/**
 * Aula propia sobre LiveKit. Es el camino principal: aquí es donde
 * `Room.supportsAutomaticAttendance` y `Room.supportsLiveTranscription` (en
 * `scheduling`) valen `true`.
 *
 * No hay ningún servidor de LiveKit desplegado todavía, así que no hay
 * llamada de red en `createRoom()`: la URL de conexión es la página propia de
 * Langopia para esa clase (el cliente web es quien habla con LiveKit usando
 * el token), y el nombre de sala es el propio id de la sesión — determinista
 * y único, así que no hace falta guardarlo aparte. Por eso `Room.of()`, en
 * `scheduling`, no exige `externalId` para este proveedor. Cuando ola 2
 * conecte un servidor real, aquí es donde iría la llamada a su
 * `RoomService.createRoom()` para preconfigurar grabación o límite de
 * participantes; el puerto no cambia.
 */
@Injectable()
export class LiveKitRoomAdapter implements RoomProviderPort {
  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  private get baseUrl(): string {
    return process.env.LIVEKIT_APP_BASE_URL ?? DEFAULT_BASE_URL;
  }

  private get apiKey(): string {
    return process.env.LIVEKIT_API_KEY ?? DEFAULT_API_KEY;
  }

  private get apiSecret(): string {
    return process.env.LIVEKIT_API_SECRET ?? DEFAULT_API_SECRET;
  }

  async createRoom(request: CreateRoomRequest): Promise<RoomCreationResult> {
    return {
      status: "created",
      url: `${this.baseUrl}/r/${request.sessionId}`,
      externalId: null,
    };
  }

  async issueJoinToken(request: IssueJoinTokenRequest): Promise<JoinToken> {
    const nowSeconds = Math.floor(this.clock.now().getTime() / 1000);
    const expiresAtSeconds = nowSeconds + TOKEN_TTL_SECONDS;

    const token = signHs256(
      {
        iss: this.apiKey,
        sub: request.participantId,
        jti: randomUUID(),
        iat: nowSeconds,
        nbf: nowSeconds,
        exp: expiresAtSeconds,
        video: {
          room: request.sessionId,
          roomJoin: true,
          canPublish: true,
          canSubscribe: true,
        },
      },
      this.apiSecret,
    );

    return { token, url: request.url, expiresAt: new Date(expiresAtSeconds * 1000) };
  }

  async deleteRoom(_request: DeleteRoomRequest): Promise<void> {
    // No-op documentado: sin servidor de LiveKit desplegado no hay nada que
    // borrar del lado del proveedor. Cuando ola 2 conecte uno real, aquí va
    // la llamada a `RoomService.deleteRoom()`. Misma deuda, mismo motivo, que
    // `NoopRecordingStorageAdapter` en este mismo contexto.
  }
}
