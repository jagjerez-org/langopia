/**
 * Nivel del Marco Común Europeo de Referencia para las lenguas.
 *
 * Lo comparten varios contextos (`catalog`, y más adelante `people` y
 * `assessment`), así que vive aquí y no dentro de uno solo de ellos
 * (`ARCHITECTURE.md`, «Nada de literales sueltos»).
 */
export const CefrLevel = {
  A1: "A1",
  A2: "A2",
  B1: "B1",
  B2: "B2",
  C1: "C1",
  C2: "C2",
} as const;

export type CefrLevel = (typeof CefrLevel)[keyof typeof CefrLevel];
