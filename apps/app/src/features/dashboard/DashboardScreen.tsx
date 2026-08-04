import type { ReactElement } from "react";
import { useT } from "../../i18n/translate.js";
import { IndicatorsRow } from "./IndicatorsRow.js";
import { AtRiskStudentsTable } from "./AtRiskStudentsTable.js";
import { TeacherOccupancyBars } from "./TeacherOccupancyBars.js";

/**
 * Panel de dirección (Tarea 6): la ruta `/`. La pantalla que ve quien
 * dirige la academia todos los días, así que el orden de arriba abajo
 * importa (verbatim del brief): lo que requiere intervención va antes que
 * lo que solo informa.
 *
 *   1. Fila de indicadores — el pulso general.
 *   2. Alumnado que requiere atención — accionable, va antes que lo
 *      meramente informativo.
 *   3. Ocupación del profesorado — informa, no exige una decisión hoy.
 *
 * Cada bloque resuelve sus propios estados de carga/vacío/error contra su
 * propia consulta (`IndicatorsRow` y `AtRiskStudentsTable` comparten la
 * misma respuesta de `GET /dashboard/summary` vía la misma clave de
 * TanStack Query, sin que este componente tenga que orquestar nada).
 */
export function DashboardScreen(): ReactElement {
  const t = useT();

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">{t("dashboard.title")}</h1>
      <IndicatorsRow />
      <AtRiskStudentsTable />
      <TeacherOccupancyBars />
    </main>
  );
}
