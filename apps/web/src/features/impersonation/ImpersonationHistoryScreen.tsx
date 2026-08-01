import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { listImpersonationHistory } from "./api.js";
import type { ImpersonationAuditEntry } from "./types.js";

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "en curso";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes} min ${rest}s`;
}

/**
 * Pantalla de auditoría (paso 12 del brief): quién actuó como quién, cuándo
 * y por qué. `owner`/`admin` solamente en la API
 * (`ImpersonationController.history`); esta pantalla solo pinta lo que
 * `GET /iam/impersonation/history` devuelve, ya filtrado por RLS a la
 * escuela activa — nunca la de otra.
 *
 * Es lo que separa esto de una puerta trasera: que el cliente pueda
 * auditarte.
 */
export function ImpersonationHistoryScreen(): ReactElement {
  const [entries, setEntries] = useState<ImpersonationAuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listImpersonationHistory()
      .then(setEntries)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <p role="alert">No se pudo cargar el historial: {error}</p>;

  return (
    <table>
      <thead>
        <tr>
          <th>Quién actuó</th>
          <th>Como quién</th>
          <th>Motivo</th>
          <th>Menor</th>
          <th>Inicio</th>
          <th>Fin</th>
          <th>Duración</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={entry.impersonationId}>
            <td>
              {entry.impersonatorName} ({entry.impersonatorEmail})
            </td>
            <td>
              {entry.targetName} — {entry.targetRole}
            </td>
            <td>{entry.reason}</td>
            <td>{entry.involvesMinor ? "sí" : "no"}</td>
            <td>{new Date(entry.startedAt).toLocaleString()}</td>
            <td>{entry.endedAt ? new Date(entry.endedAt).toLocaleString() : "—"}</td>
            <td>{formatDuration(entry.durationSeconds)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
