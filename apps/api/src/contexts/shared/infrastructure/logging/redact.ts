/**
 * Redacción de datos personales en el registro.
 *
 * Se trata con menores: un correo o una fecha de nacimiento en un log es una
 * brecha de datos con retención de 30 días (ver brief de la Tarea 8c). Estas
 * claves se enmascaran siempre, sin importar en qué nivel del objeto
 * aparezcan — el registro de un `catch` que serializa el `body` entero de la
 * petición no puede confiar en que nadie meta un campo sensible ahí dentro.
 *
 * Se compara por nombre de clave, no por ruta fija: a diferencia del `redact`
 * de Pino (rutas exactas tipo `req.headers.cookie`), esto recorre CUALQUIER
 * objeto anidado y enmascara toda clave que coincida, sin importar cuántos
 * niveles de profundidad tenga ni cómo se llame el objeto que la contiene.
 */

const MASK = "[REDACTADO]";
const CIRCULAR = "[REF-CIRCULAR]";

/**
 * Cota de profundidad, además del control de ciclos de más abajo: una
 * función de redacción que puede colgar el proceso es peor que el dato que
 * intenta proteger. Ningún registro legítimo de esta aplicación anida más de
 * esto.
 */
const MAX_DEPTH = 20;

/**
 * Coincidencia exacta (insensible a mayúsculas).
 *
 * **La lista se lee por parejas petición ↔ respuesta.** Una cabecera sensible
 * casi siempre tiene gemela en el otro sentido, y redactar solo una de las dos
 * es peor que no redactar ninguna: la que está hace creer que el asunto está
 * cubierto. Pasó de verdad —`cookie` estaba y `set-cookie` no, así que cada
 * inicio de sesión escribía en el registro la cookie de sesión entera
 * (`better-auth.session_token=…; Max-Age=604800`), reutilizable durante siete
 * días por cualquiera con acceso a los logs.
 *
 *   cookie          ↔ set-cookie            credencial de sesión
 *   authorization   ↔ proxy-authorization   credencial de portador
 *
 * `redact.spec.ts` declara esas parejas y falla si alguien añade un lado sin
 * el otro.
 */
export const SENSITIVE_KEYS = new Set([
  "email",
  "phone",
  "dateofbirth",
  "password",
  "token",
  "cookie",
  "set-cookie",
  "authorization",
  "proxy-authorization",
]);

/** Cualquier clave que EMPIECE por esto también se enmascara (p. ej. `stripeCustomerId`). */
const SENSITIVE_PREFIX = "stripe";

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEYS.has(lower) || lower.startsWith(SENSITIVE_PREFIX);
}

/**
 * Solo un objeto «bolsa de propiedades» de verdad — un literal `{...}`, o
 * `Object.create(null)` — cuenta como plano. Todo lo demás (un `Error`, una
 * `Date`, un `Map`, y sobre todo el `req`/`res` crudos de Node que Pino
 * pasa por aquí ANTES de aplicar sus propios serializadores) se deja tal
 * cual: no son un formulario que alguien haya rellenado con datos de una
 * persona, y recorrerlos entero es cómo se llega al `res.socket` que se
 * apunta a sí mismo y cuelga el proceso entero por un `RangeError: Maximum
 * call stack size exceeded` — probado en vivo al arrancar la API real.
 */
function isPlainObject(value: object): boolean {
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function redactValue(value: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return CIRCULAR;
  if (depth >= MAX_DEPTH) return CIRCULAR;

  if (Array.isArray(value)) {
    seen.add(value);
    return value.map((item) => redactValue(item, seen, depth + 1));
  }

  if (!isPlainObject(value)) return value;

  seen.add(value);
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    out[key] = isSensitiveKey(key) ? MASK : redactValue(nested, seen, depth + 1);
  }
  return out;
}

/**
 * Devuelve una copia de `value` con toda clave sensible enmascarada, a
 * cualquier profundidad, dentro de objetos y arrays planos. No muta el
 * original: un log no debería tener efectos secundarios sobre el objeto que
 * describe. Nunca lanza: es la última capa antes de escribir la línea, y una
 * excepción aquí se lleva por delante el registro de lo que sea que se
 * estuviera contando.
 */
export function redact<T>(value: T): T {
  try {
    return redactValue(value, new WeakSet(), 0) as T;
  } catch (error) {
    // No se llama al logger desde aquí a propósito: esto se ejecuta DENTRO
    // de su cadena de formateo (`formatters.log`), así que registrar el
    // fallo con el propio logger sería recursivo. `stderr` directo no lo es,
    // y es preferible a un `catch` que se traga el problema sin dejar rastro.
    process.stderr.write(`redact() ha fallado, se registra sin redactar: ${String(error)}\n`);
    return value;
  }
}

/**
 * Redacta el resultado YA serializado de `req`/`res`.
 *
 * Es el SEGUNDO camino por el que Pino recibe datos, y no basta con
 * `formatters.log`: `pino-http` adjunta `req` a cada petición con
 * `logger.child({ req })` nada más empezar, y esas «chindings» quedan
 * pre-serializadas ahí mismo — nunca pasan por `formatters.log`, que solo ve
 * el objeto que se registra en cada llamada suelta. Sin esto, la cookie o el
 * `authorization` de la petición salían en claro en la línea automática de
 * fin de petición aunque `redact` funcionara perfectamente en todo lo demás
 * (comprobado en vivo, Tarea 8c).
 *
 * `pino-http` envuelve CUALQUIER serializador de `req`/`res` que se le pase
 * con el suyo propio (`wrapRequestSerializer`/`wrapResponseSerializer`,
 * activado por defecto): para cuando esta función se ejecuta, `value` YA es
 * el objeto `{method, url, headers, ...}` / `{statusCode, headers}` de
 * `pino-std-serializers`, no el `IncomingMessage`/`ServerResponse` en
 * crudo. Volver a aplicar el serializador estándar aquí dentro —como hacía
 * una versión anterior de este fichero— le pasa a `pino-std-serializers` un
 * objeto que ya no es un `ServerResponse` de verdad, y el resultado sale
 * roto (`{statusCode: null}`, comprobado en vivo). Lo único que hace falta
 * aquí es redactar lo que ya ha llegado.
 *
 * Tampoco es un objeto plano —`pino-std-serializers` usa su propio
 * prototipo interno—, así que `redact` (que solo recorre objetos planos, a
 * propósito, ver más arriba) lo ignoraría sin este `JSON.parse(
 * JSON.stringify(...))` de por medio: dejarlo en un objeto y arrays planos
 * de verdad es lo que permite recorrerlo con garantías. `res.headers` sale de
 * `res.getHeaders()`, así que `set-cookie` llega aquí como array de cadenas:
 * la clave se enmascara entera, sin recorrer el array.
 */
export function redactSerialized(value: unknown): unknown {
  try {
    return redact(JSON.parse(JSON.stringify(value)));
  } catch (error) {
    // Si esto llega a pasar, `redact` recibe el objeto con el prototipo
    // interno de Pino tal cual, que NO reconoce como plano (a propósito, ver
    // arriba) — así que `req.headers.cookie` podría colarse sin enmascarar.
    // No debería ocurrir nunca con la forma que da `pino-std-serializers`,
    // pero si ocurre hay que poder verlo, no suponerlo.
    process.stderr.write(
      `redactSerialized() no pudo clonar antes de redactar: ${String(error)}\n`,
    );
    return redact(value);
  }
}
