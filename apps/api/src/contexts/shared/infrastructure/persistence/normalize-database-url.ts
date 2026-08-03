import {
  parse as parseConnectionString,
  type ConnectionOptions as PgConnectionOptions,
} from "pg-connection-string";

/**
 * Asegura que una URL de conexión a Postgres sea parseable.
 *
 * Las contraseñas generadas por proveedores como Neon pueden contener
 * caracteres reservados de URL (`#`, `[`, `]`, espacios...) que rompen
 * `new URL()` y, por tanto, el cliente `postgres` usado por Drizzle. Este
 * helper codifica el usuario y la contraseña cuando detecta que la URL es
 * inválida, sin volver a codificar valores que ya vengan escapados.
 *
 * No codifica caracteres permitidos en `userinfo` según RFC 3986
 * (`unreserved` + `sub-delims` + `:`), por lo que una contraseña segura pero
 * ya válida (`P@ssw0rd!`) pasa intacta.
 */
export function normalizeDatabaseUrl(url: string): string {
  if (URL.canParse(url)) {
    return url;
  }

  const protocolEnd = url.indexOf("://");
  if (protocolEnd === -1) return url;

  const protocol = url.slice(0, protocolEnd + 3);
  const rest = url.slice(protocolEnd + 3);

  // Fin de la parte de autoridad (credenciales + host + puerto). No usamos
  // `#` como delimitador porque, precisamente, puede ser parte de la
  // contraseña sin escapar; las URL de conexión a bases de datos no usan
  // fragmento.
  const authorityEnd = Math.min(
    rest.indexOf("/") === -1 ? Infinity : rest.indexOf("/"),
    rest.indexOf("?") === -1 ? Infinity : rest.indexOf("?"),
  );
  const authority = authorityEnd === Infinity ? rest : rest.slice(0, authorityEnd);
  const remainder = authorityEnd === Infinity ? "" : rest.slice(authorityEnd);

  const atIndex = authority.lastIndexOf("@");
  if (atIndex === -1) return url;

  const userinfo = authority.slice(0, atIndex);
  const hostinfo = authority.slice(atIndex + 1);

  const colonIndex = userinfo.indexOf(":");
  const user = colonIndex === -1 ? userinfo : userinfo.slice(0, colonIndex);
  const pass = colonIndex === -1 ? "" : userinfo.slice(colonIndex + 1);

  return `${protocol}${encodeUserinfoPart(user)}:${encodeUserinfoPart(pass)}@${hostinfo}${remainder}`;
}

function encodeUserinfoPart(part: string): string {
  try {
    // Si la parte ya viene escapada (p. ej. `%23`), primero la decodificamos
    // para no doble-escapar. Si no está escapada, decodeURIComponent es
    // idéntica para caracteres que no empiecen por `%`.
    return encodeURIComponent(decodeURIComponent(part));
  } catch {
    // Contenía un `%` literal seguido de caracteres no hexadecimales: se
    // escapa tal cual.
    return encodeURIComponent(part);
  }
}

/**
 * Opciones de conexión a base de datos, listas para usar con `pg.Pool` o
 * con el cliente `postgres` de Drizzle.
 *
 * A diferencia de una URL string, este objeto transporta la contraseña ya
 * separada del resto de componentes, por lo que caracteres reservados como
 * `#` no pueden volver a romper el parser de ningún driver.
 */
export interface DatabaseConnectionOptions {
  host: string;
  port?: number;
  database: string;
  user: string;
  password?: string;
  ssl?: boolean | object;
  application_name?: string;
  fallback_application_name?: string;
  client_encoding?: string;
  options?: string;
  keepalives?: number;
}

/**
 * Convierte una URL de conexión en un objeto de opciones robusto.
 *
 * Primero normaliza la URL para escapar caracteres reservados en las
 * credenciales y luego la parsea con `pg-connection-string`, que es el mismo
 * parser que usa `pg`. El objeto resultante se puede pasar directamente a
 * `postgres(...)` o a `new Pool(...)` sin depender de que el driver vuelva a
 * parsear una URL string.
 */
export function parseDatabaseUrl(url: string): DatabaseConnectionOptions {
  const normalized = normalizeDatabaseUrl(url);
  const parsed = parseConnectionString(normalized);

  if (!parsed.user) {
    throw new Error("La URL de conexión no incluye usuario");
  }
  if (!parsed.host) {
    throw new Error("La URL de conexión no incluye host");
  }
  if (!parsed.database) {
    throw new Error("La URL de conexión no incluye nombre de base de datos");
  }

  const port = parsed.port ? Number(parsed.port) : undefined;

  return {
    host: parsed.host,
    port,
    database: parsed.database,
    user: parsed.user,
    password: parsed.password,
    ssl: typeof parsed.ssl === "string" ? { sslmode: parsed.ssl } : parsed.ssl,
    application_name: parsed.application_name,
    fallback_application_name: parsed.fallback_application_name,
    client_encoding: parsed.client_encoding,
    options: parsed.options,
    keepalives: parsed.keepalives,
  };
}
