import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { endImpersonation, getActiveImpersonation } from "./api.js";
import type { ActiveImpersonation } from "./types.js";

const POLL_MS = 15_000;

function remaining(expiresAt: string, now: Date): string {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (ms <= 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Aviso permanente de impersonación (paso 10 del brief).
 *
 * Sin botón de cerrar, a propósito: "la sesión impersonada no puede ocultar
 * el aviso en el panel. Si se puede cerrar, alguien trabajará una hora sin
 * recordar que no es él" (brief de la tarea). El único botón que ofrece es
 * el de salir de verdad — terminar la impersonación —, nunca uno que solo
 * la oculte de la vista.
 *
 * Monta esto en el layout raíz del panel, fuera de cualquier ruta, para que
 * ninguna pantalla pueda quedarse sin él por accidente. Sondea cada
 * `POLL_MS`: si la impersonación caduca sola (30 min, no se renueva), el
 * aviso desaparece solo en la siguiente vuelta sin que nadie tenga que
 * cerrarla a mano.
 */
export function ImpersonationBanner(): ReactElement | null {
  const [state, setState] = useState<ActiveImpersonation | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getActiveImpersonation()
        .then((value) => {
          if (!cancelled) setState(value);
        })
        .catch(() => {
          // Sondeo silencioso a propósito: un fallo de red no debe pintar un
          // error encima de todas las pantallas del panel. La siguiente
          // vuelta lo reintenta.
        });
    };
    load();
    const poll = setInterval(load, POLL_MS);
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

  if (!state) return null;

  const handleEnd = async () => {
    setEnding(true);
    try {
      await endImpersonation();
      setState(null);
    } finally {
      setEnding(false);
    }
  };

  return (
    <div
      role="alert"
      style={{
        background: "#7a1f1f",
        color: "#fff",
        padding: "0.5rem 1rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        fontSize: "0.9rem",
        position: "sticky",
        top: 0,
        zIndex: 1000,
      }}
    >
      <span>
        Eres <strong>{state.impersonatorName}</strong>, actuando como{" "}
        <strong>{state.targetName}</strong>. Motivo: {state.reason}. Quedan{" "}
        {remaining(state.expiresAt, now)} min.
      </span>
      <button type="button" onClick={handleEnd} disabled={ending}>
        {ending ? "Saliendo…" : "Salir de la impersonación"}
      </button>
    </div>
  );
}
