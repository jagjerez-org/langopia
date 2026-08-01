/**
 * Unidad de trabajo.
 *
 * Un caso de uso puede tocar varios repositorios; o se guardan todos o
 * ninguno. La capa de aplicación pide la transacción sin saber que por debajo
 * hay Postgres.
 *
 * Aquí es también donde se fija el contexto de escuela para las políticas RLS
 * (`set_config('app.school_id', …, true)`), de modo que el aislamiento entre
 * tenants no depende de que cada consulta se acuerde de filtrar.
 */
export interface UnitOfWork {
  /**
   * Ejecuta `work` dentro de una transacción con el tenant fijado. Si `work`
   * lanza, se deshace todo y no se publica ningún evento de dominio.
   */
  execute<T>(work: () => Promise<T>): Promise<T>;

  /**
   * Igual, para el lado de lectura.
   *
   * Existe porque las consultas TAMBIÉN necesitan el contexto de escuela:
   * sin él, las políticas de aislamiento no dejan ver ninguna fila y el
   * resultado es una lista vacía sin error, que parece «no hay datos» cuando
   * en realidad es «no me has dicho de quién».
   */
  read<T>(work: () => Promise<T>): Promise<T>;
}

export const UNIT_OF_WORK = Symbol("UnitOfWork");
