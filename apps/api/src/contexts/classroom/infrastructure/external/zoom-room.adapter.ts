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

/** El enlace de Zoom no expira por nuestra cuenta; esto solo fuerza a volver a preguntar si algo cambió. */
const ANSWER_TTL_MS = 60 * 60 * 1000;

/**
 * Zoom necesita que la escuela conecte su cuenta por OAuth para que podamos
 * programar la reunión en su nombre — todavía no existe esa conexión: no hay
 * tabla ni flujo de OAuth de vídeo en este monorepo. Mismo tipo de deuda,
 * documentada igual, que `SchoolSchedulingPolicyAdapter` en `scheduling`
 * («la antelación mínima todavía no es una columna»).
 *
 * Por eso `createRoom()` nunca crea nada de verdad: la clase se programa
 * igual —`scheduling` ya exige un enlace para este proveedor al programarla—
 * y esta sala queda marcada como pendiente hasta que ola 2 traiga el OAuth
 * real. `issueJoinToken()` no firma nada propio: entrar a Zoom es abrir su
 * enlace con la cuenta de Zoom de quien se conecta, así que el «token» es el
 * propio enlace.
 */
@Injectable()
export class ZoomRoomAdapter implements RoomProviderPort {
  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  async createRoom(_request: CreateRoomRequest): Promise<RoomCreationResult> {
    return {
      status: "pending",
      reason: "La escuela todavía no tiene Zoom conectado (OAuth pendiente).",
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
    // que borrar en Zoom.
  }
}
