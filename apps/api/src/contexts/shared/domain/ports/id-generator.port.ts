/**
 * Generador de identificadores.
 *
 * El dominio crea agregados ya con su id, sin esperar a que la base de datos
 * le devuelva uno. Eso permite construir un grafo entero de objetos y
 * guardarlo en una sola transacción, y hace las pruebas deterministas.
 */
export interface IdGenerator {
  generate(): string;
}

export const ID_GENERATOR = Symbol("IdGenerator");
