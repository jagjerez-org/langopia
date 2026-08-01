import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import type { Room } from "livekit-client";
import { Button } from "../../ui/index.js";
import { useT } from "../../i18n/translate.js";

export interface LiveKitRoomProps {
  url: string;
  token: string;
}

type ConnectionState = "connecting" | "connected" | "failed";

type ParticipantRow = { identity: string; isLocal: boolean };

/**
 * Aula propia sobre LiveKit (Paso 3 del brief, verbatim): vídeo, audio y
 * lista de participantes, contra el servidor de vídeo de verdad — no una
 * maqueta. `join` (API) firma un token de LiveKit válido, pero el brief de
 * la propia API documenta que **no hay ningún servidor LiveKit desplegado
 * todavía** (`LiveKitRoomAdapter`, `apps/api/.../classroom/infrastructure/
 * external/livekit-room.adapter.ts`): la URL de conexión es hoy la página
 * propia de Langopia para la clase, no un `wss://` real. Esta pantalla lo
 * intenta de verdad —nunca finge una conexión que no existe— y, si el
 * servidor no responde, lo dice con honestidad en vez de mostrar vídeo o
 * participantes que nadie ha conectado.
 */
export function LiveKitRoom({ url, token }: LiveKitRoomProps): ReactElement {
  const t = useT();
  const [state, setState] = useState<ConnectionState>("connecting");
  const [failureDetail, setFailureDetail] = useState<string | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [micEnabled, setMicEnabled] = useState(false);
  const [camEnabled, setCamEnabled] = useState(false);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    let disposed = false;

    async function connect(): Promise<void> {
      const { Room, RoomEvent, Track } = await import("livekit-client");
      const room = new Room();
      roomRef.current = room;

      function refreshParticipants(): void {
        if (disposed) return;
        const rows: ParticipantRow[] = [
          { identity: room.localParticipant.identity || t("classroom.you"), isLocal: true },
        ];
        room.remoteParticipants.forEach((participant) => {
          rows.push({ identity: participant.identity, isLocal: false });
        });
        setParticipants(rows);
      }

      room
        .on(RoomEvent.ParticipantConnected, refreshParticipants)
        .on(RoomEvent.ParticipantDisconnected, refreshParticipants)
        .on(RoomEvent.Disconnected, () => {
          if (!disposed) setState("failed");
        })
        .on(RoomEvent.TrackSubscribed, (track) => {
          if (disposed || !videoContainerRef.current) return;
          if (track.kind === Track.Kind.Video) {
            videoContainerRef.current.appendChild(track.attach());
          }
        });

      try {
        await room.connect(url, token);
        if (disposed) {
          await room.disconnect();
          return;
        }
        setState("connected");
        refreshParticipants();
      } catch (error) {
        if (!disposed) {
          setState("failed");
          setFailureDetail(error instanceof Error ? error.message : String(error));
        }
      }
    }

    void connect();

    return () => {
      disposed = true;
      void roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, [url, token, t]);

  async function toggleMic(): Promise<void> {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.localParticipant.setMicrophoneEnabled(!micEnabled);
      setMicEnabled(!micEnabled);
    } catch {
      // Sin permiso de micrófono o sin hardware disponible: no rompe el aula.
    }
  }

  async function toggleCam(): Promise<void> {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.localParticipant.setCameraEnabled(!camEnabled);
      setCamEnabled(!camEnabled);
    } catch {
      // Sin permiso de cámara o sin hardware disponible: no rompe el aula.
    }
  }

  if (state === "connecting") {
    return (
      <p role="status" aria-busy="true">
        {t("classroom.connecting")}
      </p>
    );
  }

  if (state === "failed") {
    return (
      <div role="alert">
        <p>{t("classroom.connectionFailedTitle")}</p>
        <p>{t("classroom.connectionFailedDescription")}</p>
        {failureDetail && (
          <p className="text-secondary text-sm">
            {t("classroom.connectionFailedDetailLabel")}: {failureDetail}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div ref={videoContainerRef} data-testid="livekit-video-container" />
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => void toggleMic()}>
          {micEnabled ? t("classroom.muteMic") : t("classroom.unmuteMic")}
        </Button>
        <Button variant="secondary" onClick={() => void toggleCam()}>
          {camEnabled ? t("classroom.disableCam") : t("classroom.enableCam")}
        </Button>
      </div>
      <div>
        <h2 className="text-lg font-medium mb-2">{t("classroom.participantsTitle")}</h2>
        <ul>
          {participants.map((participant) => (
            <li key={participant.identity}>
              {participant.isLocal ? t("classroom.you") : participant.identity}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
