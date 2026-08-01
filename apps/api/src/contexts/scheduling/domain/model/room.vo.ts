import { ValueObject } from "../../../shared/domain/primitives/value-object.js";
import { DomainError } from "../../../shared/domain/errors/domain-error.js";

export const RoomProvider = {
  LiveKit: "livekit",
  Zoom: "zoom",
  GoogleMeet: "google_meet",
  MsTeams: "ms_teams",
  InPerson: "in_person",
} as const;

export type RoomProvider = (typeof RoomProvider)[keyof typeof RoomProvider];

/** Compatibilidad: los DTO de entrada validan contra una lista, no un objeto. */
export const ROOM_PROVIDERS = Object.values(RoomProvider) as readonly RoomProvider[];

export class InvalidRoomError extends DomainError {
  readonly code = "invalid_room";
  readonly kind = "invalid_input" as const;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, details);
  }
}

/**
 * El aula donde se da la clase.
 *
 * La distinción importa más allá de la URL: solo en el aula propia se puede
 * tomar asistencia automática y transcribir en directo. En Zoom, Meet o Teams
 * dependemos de lo que su API nos deje importar después.
 */
export class Room extends ValueObject<{
  provider: RoomProvider;
  url: string | null;
  externalId: string | null;
}> {
  private constructor(provider: RoomProvider, url: string | null, externalId: string | null) {
    super({ provider, url, externalId });
  }

  static of(params: {
    provider: RoomProvider;
    url?: string | null;
    externalId?: string | null;
  }): Room {
    const { provider } = params;
    const url = params.url ?? null;
    const externalId = params.externalId ?? null;

    if (provider !== RoomProvider.InPerson && !url) {
      throw new InvalidRoomError(`Una clase en ${provider} necesita un enlace de conexión.`, {
        provider,
      });
    }
    if (provider !== RoomProvider.InPerson && provider !== RoomProvider.LiveKit && !externalId) {
      throw new InvalidRoomError(
        `Una clase en ${provider} necesita el identificador de la reunión para poder importar asistencia y transcripción.`,
        { provider },
      );
    }
    return new Room(provider, url, externalId);
  }

  static inPerson(): Room {
    return new Room(RoomProvider.InPerson, null, null);
  }

  get provider(): RoomProvider {
    return this.props.provider;
  }

  get url(): string | null {
    return this.props.url;
  }

  get externalId(): string | null {
    return this.props.externalId;
  }

  /** Solo el aula propia da asistencia automática y transcripción en directo. */
  get supportsAutomaticAttendance(): boolean {
    return this.props.provider === RoomProvider.LiveKit;
  }

  get supportsLiveTranscription(): boolean {
    return this.props.provider === RoomProvider.LiveKit;
  }
}
