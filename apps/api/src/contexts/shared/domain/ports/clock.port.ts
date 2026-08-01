/**
 * El reloj, como puerto.
 *
 * Sin esto, cualquier regla que dependa de «ahora» —la antelación con la que
 * se cancela una clase, si un alumno es menor, si una factura está vencida—
 * solo se puede probar esperando a que pase el tiempo. Con esto se prueba
 * fijando la hora.
 */
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol("Clock");
