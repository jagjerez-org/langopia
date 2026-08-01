/**
 * Reparte en "carriles" horizontales las clases de un mismo día que se
 * solapan en el tiempo, para que la vista semanal (`WeekGrid`) las pinte una
 * al lado de la otra en vez de una encima de la otra. Puro cálculo de
 * maquetación: no decide nada de negocio, solo geometría.
 *
 * Algoritmo voraz en dos pasadas: primero asigna cada clase al primer carril
 * que quede libre a esa hora (como el reparto de columnas de un calendario de
 * Google/Outlook); después, para cada clase, cuenta cuántos carriles usa
 * cualquier clase que se solape con ella —incluida ella misma—, que es el
 * número de columnas entre las que hay que repartir el ancho.
 */
export function layoutDayLanes<T extends { startMinutes: number; endMinutes: number }>(
  entries: T[],
): Array<T & { lane: number; laneCount: number }> {
  const sorted = [...entries].sort((a, b) => a.startMinutes - b.startMinutes);

  const laneEnds: number[] = [];
  const withLane = sorted.map((entry) => {
    let lane = laneEnds.findIndex((end) => end <= entry.startMinutes);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(entry.endMinutes);
    } else {
      laneEnds[lane] = entry.endMinutes;
    }
    return { ...entry, lane };
  });

  return withLane.map((entry) => {
    let maxLane = entry.lane;
    for (const other of withLane) {
      const overlaps = other.startMinutes < entry.endMinutes && entry.startMinutes < other.endMinutes;
      if (overlaps) maxLane = Math.max(maxLane, other.lane);
    }
    return { ...entry, laneCount: maxLane + 1 };
  });
}
