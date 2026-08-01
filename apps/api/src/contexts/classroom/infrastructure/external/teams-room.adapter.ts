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

/** El enlace de Teams no expira por nuestra cuenta; esto solo fuerza a volver a preguntar si algo cambió. */
const ANSWER_TTL_MS = 60 * 60 * 1000;

/**
 * Microsoft Teams necesita que la escuela conecte su cuenta de Microsoft 365
 * por OAuth para poder programar la reunión en su nombre — esa conexión no
 * existe todavía en este monorepo (mismo tipo de deuda que `ZoomRoomAdapter`,
 * documentada allí con más detalle).
 *
 * `createRoom()` nunca crea nada de verdad: la clase se programa igual y la
 * sala queda pendiente. `issueJoinToken()` no firma nada propio: entrar a
 * Teams es abrir su enlace con la cuenta de Microsoft de quien se conecta.
 */
@Injectable()
export class TeamsRoomAdapter implements RoomProviderPort {
  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  async createRoom(_request: CreateRoomRequest): Promise<RoomCreationResult> {
    return {
      status: "pending",
      reason: "La escuela todavía no tiene Microsoft Teams conectado (OAuth pendiente).",
    };
  }

  async issueJoinToken(request: IssueJoinTokenRequest): Promise<JoinToken> {
    return {
      token: request.url,
      url: request.url,
      expiresAt: new Date(this.clock.now().getTime() + ANSWER_TTL_MS),
    };
  }

  async deleteRoom(_request: DeleteRoomRequest): Promise<void> {
    // No-op: nunca llegamos a crear la reunión nosotros, así que no hay nada
    // que borrar en Teams.
  }
}
