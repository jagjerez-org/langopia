import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { Button, Panel, ErrorState, Skeleton, Chip } from "@langopia/ui";
import { useT } from "../../i18n/translate.js";
import { useErrorMessage } from "../../i18n/errors.js";
import { ApiError } from "../../lib/api-client.js";
import { joinSession } from "./api.js";
import { LiveKitRoom } from "./LiveKitRoom.js";
import { resolveRoomKind } from "./room-kind.js";

/**
 * `/aula/:sessionId` (Paso 3 del brief, verbatim): el aula, sobre LiveKit
 * cuando la clase es de la escuela, o un enlace a la plataforma externa
 * (Zoom, Google Meet, Microsoft Teams) cuando no lo es — `resolveRoomKind`
 * decide cuál según la FORMA de lo que ya devolvió `join`, nunca adivinando
 * el proveedor por su nombre.
 *
 * El aviso de grabación bloqueada (Paso 4) llega en la MISMA respuesta que
 * el token (`recording`, ya decidido por `JoinClassroomSessionHandler`): esta
 * pantalla lo muestra tal cual, nunca decide ella misma si hay consentimiento
 * suficiente para grabar.
 */
export function ClassroomScreen(): ReactElement {
  const t = useT();
  const errorMessage = useErrorMessage();
  const { sessionId } = useParams({ strict: false }) as { sessionId?: string };

  const joinQuery = useQuery({
    queryKey: ["classroom", "join", sessionId] as const,
    queryFn: () => joinSession(sessionId as string),
    enabled: Boolean(sessionId),
    retry: false,
  });

  if (!sessionId) {
    return (
      <main className="p-6">
        <ErrorState title={t("classroom.missingSessionTitle")} />
      </main>
    );
  }

  if (joinQuery.isPending) {
    return (
      <main className="p-6">
        <Skeleton variant="text" lines={4} />
      </main>
    );
  }

  if (joinQuery.isError) {
    const problem = joinQuery.error instanceof ApiError ? joinQuery.error.problem : null;
    return (
      <main className="p-6">
        <ErrorState
          title={problem ? errorMessage(problem) : t("classroom.errorTitle")}
          action={<Button onClick={() => void joinQuery.refetch()}>{t("common.retry")}</Button>}
        />
      </main>
    );
  }

  const { token, url, recording } = joinQuery.data;
  const kind = resolveRoomKind(token, url);

  return (
    <main className="p-6 flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("classroom.title")}</h1>

      {recording.blocked && (
        <Chip variant="warning">
          {t("classroom.recordingBlocked", {
            reason: recording.blockedReason ?? t("classroom.recordingBlockedReasonUnknown"),
          })}
        </Chip>
      )}

      {kind === "external" ? (
        <Panel title={t("classroom.externalTitle")}>
          <p className="mb-4">{t("classroom.externalDescription")}</p>
          <a href={url} target="_blank" rel="noreferrer">
            {t("classroom.externalOpenLink")}
          </a>
        </Panel>
      ) : (
        <LiveKitRoom url={url} token={token} />
      )}
    </main>
  );
}
