import { Injectable } from "@nestjs/common";
import { RoomProvider } from "../../domain/model/room-provider.js";
import type {
  CreateRoomRequest,
  DeleteRoomRequest,
  IssueJoinTokenRequest,
  JoinToken,
  RoomCreationResult,
  RoomProviderPort,
} from "../../domain/ports/room-provider.port.js";
import { GoogleMeetRoomAdapter } from "./google-meet-room.adapter.js";
import { LiveKitRoomAdapter } from "./livekit-room.adapter.js";
import { TeamsRoomAdapter } from "./teams-room.adapter.js";
import { ZoomRoomAdapter } from "./zoom-room.adapter.js";

/**
 * El selector del que habla el brief: «un puerto, cuatro adaptadores; el
 * selector se resuelve por `roomProvider` de la clase».
 *
 * Este registro implementa el mismo `RoomProviderPort` que sus cuatro
 * adaptadores y solo delega según `request.provider`: quien lo usa (el
 * manejador del evento, el comando de unirse) pide `ROOM_PROVIDER_PORT` sin
 * saber que hay más de un proveedor detrás.
 */
@Injectable()
export class RoomProviderRegistry implements RoomProviderPort {
  constructor(
    private readonly liveKit: LiveKitRoomAdapter,
    private readonly googleMeet: GoogleMeetRoomAdapter,
    private readonly zoom: ZoomRoomAdapter,
    private readonly teams: TeamsRoomAdapter,
  ) {}

  createRoom(request: CreateRoomRequest): Promise<RoomCreationResult> {
    return this.adapterFor(request.provider).createRoom(request);
  }

  issueJoinToken(request: IssueJoinTokenRequest): Promise<JoinToken> {
    return this.adapterFor(request.provider).issueJoinToken(request);
  }

  deleteRoom(request: DeleteRoomRequest): Promise<void> {
    return this.adapterFor(request.provider).deleteRoom(request);
  }

  private adapterFor(provider: RoomProvider): RoomProviderPort {
    switch (provider) {
      case RoomProvider.LiveKit:
        return this.liveKit;
      case RoomProvider.Zoom:
        return this.zoom;
      case RoomProvider.GoogleMeet:
        return this.googleMeet;
      case RoomProvider.MsTeams:
        return this.teams;
      case RoomProvider.InPerson:
        // Una clase presencial no tiene proveedor de vídeo: quien llama
        // (el manejador del evento, el comando de unirse) tiene que haberlo
        // filtrado antes de llegar aquí.
        throw new Error("Una clase presencial no usa ningún proveedor de vídeo.");
    }
  }
}
