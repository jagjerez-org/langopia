import { betterAuth } from "better-auth";
import type { PinoLogger } from "nestjs-pino";
import { Pool } from "pg";

/**
 * Better Auth gestiona SUS propias tablas (`user`, `session`, `account`,
 * `verification`). No se mezclan con nuestro esquema: `users` de Langopia
 * guarda el perfil de la persona, y esta tabla guarda credenciales y sesiones.
 * El puente entre ambas es `users.auth_user_id`, con clave foránea única contra
 * `user.id`.
 *
 * Esas cuatro tablas son GLOBALES, no llevan `school_id`: una misma persona
 * puede dar clase en dos escuelas y su credencial es una sola. El aislamiento
 * no vive aquí, vive en `memberships` (Tarea 6). Por eso el fichero de
 * políticas del paquete de datos las deja fuera del modelo multi-tenant, con
 * RLS activado y sin permisos para el rol `langopia_app`: solo este `Pool`,
 * que usa el rol dueño, las toca.
 *
 * **La verificación del correo no es un adorno.** Cuando el puente con `users`
 * era el correo, era además lo único que impedía que quien se registrara con el
 * correo del dueño de una escuela se quedara con la escuela. Ese camino ya está
 * cerrado por diseño —el tenant se resuelve por `auth_user_id`—, y la
 * verificación sigue siendo obligatoria igualmente: es la prueba de que quien
 * tiene la credencial es quien dice ser, y de ella dependen la invitación por
 * correo y el aprovisionamiento que faltan. Por eso
 * `requireEmailVerification` está activado —sin verificar no hay inicio de
 * sesión— y además `SessionTenantGuard` se niega a fijar tenant para una sesión
 * cuyo `emailVerified` sea falso. Dos cierres para el mismo agujero, porque uno
 * de los dos es configuración y la configuración se cambia sin querer.
 */
/**
 * Orígenes que pueden hablar con Better Auth cuando no son el propio de la API.
 *
 * Toda ruta suya que cambia estado —empezando por el inicio de sesión— valida
 * la cabecera `Origin` contra esta lista y responde 403 `INVALID_ORIGIN` si no
 * encaja. Better Auth confía por defecto SOLO en el origen de `BETTER_AUTH_URL`,
 * así que sin configurar nada el panel de la ola 1 —que vive en otro puerto y,
 * en producción, en otro dominio— no podría ni iniciar sesión.
 *
 * Se configura con `BETTER_AUTH_TRUSTED_ORIGINS`, una lista separada por comas.
 * El valor por defecto es el del servidor de desarrollo de Vite, que es donde
 * vive el panel mientras se programa; en producción hay que declararlo, y si
 * falta se avisa en vez de dejar que la primera pantalla de acceso lo descubra.
 */
const DEFAULT_TRUSTED_ORIGINS = ["http://localhost:5173"];

export function parseTrustedOrigins(raw: string | undefined): string[] {
  const declarados = (raw ?? "")
    .split(",")
    .map((origen) => origen.trim())
    .filter((origen) => origen.length > 0);
  return declarados.length > 0 ? declarados : [...DEFAULT_TRUSTED_ORIGINS];
}

function resolveTrustedOrigins(logger: PinoLogger): string[] {
  const raw = process.env.BETTER_AUTH_TRUSTED_ORIGINS;
  const origins = parseTrustedOrigins(raw);
  if (!raw && process.env.NODE_ENV === "production") {
    logger.warn(
      `Falta BETTER_AUTH_TRUSTED_ORIGINS: solo se confía en ${origins.join(", ")} y en el origen ` +
        "de BETTER_AUTH_URL. Cualquier panel servido desde otro dominio recibirá 403 al entrar.",
    );
  }
  return origins;
}

export function createAuth(connectionString: string, logger: PinoLogger) {
  return betterAuth({
    database: new Pool({ connectionString }),
    trustedOrigins: resolveTrustedOrigins(logger),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        // El envío de correo de verdad es la Tarea 12 de la ola 1. Hasta
        // entonces el enlace va al registro, que en desarrollo es donde se
        // puede leer. En producción NO se escribe —es una credencial de un solo
        // uso— y se avisa de que nadie lo va a recibir.
        if (process.env.NODE_ENV === "production") {
          logger.error(
            `Sin proveedor de correo: el enlace de verificación de ${user.id} no se ha enviado a nadie.`,
          );
          return;
        }
        logger.info(`Verificación de correo (solo desarrollo) para ${user.id}: ${url}`);
      },
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 7 },
  });
}

export type Auth = ReturnType<typeof createAuth>;
export const AUTH = Symbol("Auth");
