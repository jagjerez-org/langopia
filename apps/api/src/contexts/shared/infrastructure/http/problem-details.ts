/**
 * Cuerpo de error único de la API — RFC 9457 (Problem Details).
 *
 * Es el único formato de error que sale de la API entera, venga el fallo de
 * donde venga: un `DomainError`, una validación de Nest, un error de Postgres
 * o cualquier otra cosa que nadie esperaba. Lo construye `AllExceptionsFilter`;
 * este fichero solo sabe darle forma al cuerpo, no decide qué va en cada
 * campo para cada tipo de error.
 *
 * `code` es estable, en inglés, y no se traduce nunca: es lo que el cliente
 * compara para decidir qué hacer. `title` va traducido e interpolado (T8) para
 * quien no tiene su propio catálogo — un correo, una factura en PDF, una
 * respuesta MCP, un webhook.
 *
 * `params` viaja aparte de `details` a propósito, aunque hoy compartan el
 * mismo contenido (los `details` que declara el propio `DomainError`): un
 * panel con su propio catálogo de traducciones prefiere `params`, sin el
 * texto ya incrustado; `details` es para quien solo quiere los datos, sin
 * traducir nada.
 */
export interface FieldError {
  field: string;
  message: string;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: string;
  instance: string;
  traceId: string;
  params?: Record<string, unknown>;
  details?: Record<string, unknown>;
  errors?: FieldError[];
}

const TYPE_BASE = "https://langopia.app/errors/";

/**
 * Construye el cuerpo. Nunca recibe el error original entero: quien llama
 * decide explícitamente qué claves de `details`/`params` expone — nunca un
 * `{ ...error }` que arrastraría `stack`, `name` o lo que sea que traiga el
 * error de verdad. Las claves vacías u omitidas no aparecen en el cuerpo, en
 * vez de aparecer como `{}` o `[]` sin aportar nada.
 */
export function buildProblemDetails(input: {
  code: string;
  title: string;
  status: number;
  instance: string;
  traceId: string;
  params?: Record<string, unknown>;
  details?: Record<string, unknown>;
  errors?: FieldError[];
}): ProblemDetails {
  const body: ProblemDetails = {
    type: `${TYPE_BASE}${input.code}`,
    title: input.title,
    status: input.status,
    code: input.code,
    instance: input.instance,
    traceId: input.traceId,
  };
  if (input.params && Object.keys(input.params).length > 0) body.params = input.params;
  if (input.details && Object.keys(input.details).length > 0) body.details = input.details;
  if (input.errors && input.errors.length > 0) body.errors = input.errors;
  return body;
}
