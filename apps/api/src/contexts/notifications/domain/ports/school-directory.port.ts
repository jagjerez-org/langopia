/**
 * Identificadores de todas las escuelas.
 *
 * Copia del mismo puerto de `classroom` (`domain/ports/school-directory.port.ts`),
 * duplicado a propósito en vez de compartido: no hay ningún sitio común desde
 * el que ambos contextos puedan importarlo sin cruzar su frontera, y es la
 * misma excepción acotada a «todo acceso a datos va dentro de `uow`» —el
 * trabajo programado del recordatorio de clase corre sin sesión HTTP, así que
 * antes de fijar el primer tenant hace falta saber por cuáles escuelas
 * empezar—.
 */
export interface SchoolDirectoryPort {
  allIds(): Promise<string[]>;
}

export const SCHOOL_DIRECTORY = Symbol("SchoolDirectoryPort");
