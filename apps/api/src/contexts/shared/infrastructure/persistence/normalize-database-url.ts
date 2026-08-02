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
