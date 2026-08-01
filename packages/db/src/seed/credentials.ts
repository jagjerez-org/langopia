/**
 * Credenciales de Better Auth para las personas del seed.
 *
 * Sin esto nadie del seed puede entrar. Antes tampoco podía, y el apaño era
 * registrarse por la API con el correo de una persona sembrada —que es
 * exactamente el ataque que la verificación de correo acaba de cerrar—. Así que
 * las credenciales las crea el seed, explícitamente y ya verificadas.
 *
 * Se escriben las dos tablas que Better Auth espera:
 *
 *   user     → la identidad, con `emailVerified = true`. Es lo que permite
 *              iniciar sesión ahora que `requireEmailVerification` está puesto.
 *   account  → la credencial `credential` (correo y contraseña), con el hash en
 *              el formato de Better Auth.
 *
 * Y se ata cada una a su persona del dominio con `users.auth_user_id`. Ese es
 * el puente que resuelve el tenant (`memberships_for_auth_user`): sin él la
 * credencial existe, el inicio de sesión funciona y la respuesta es «No
 * perteneces a ninguna escuela». El correo ya no interviene más que aquí, al
 * decidir a quién corresponde cada credencial recién creada.
 *
 * El hash lo genera la propia librería (`better-auth/crypto`) en vez de
 * reimplementar sus parámetros de scrypt: si algún día los cambia, el seed la
 * sigue sin enterarse de nada. Es la única razón por la que este paquete
 * depende de `better-auth`, y solo como dependencia de desarrollo: el `dist`
 * publicado excluye `src/seed/**`.
 *
 * TODAS las personas comparten contraseña. Es un seed de desarrollo cuyo
 * usuario de base de datos ya tiene la contraseña en el `.env`; lo que importa
 * es que el entorno sea desechable, y lo es.
 */
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { eq, sql } from "drizzle-orm";
import type { Db } from "../index.js";
import * as s from "../schema/index.js";

/** Contraseña de todas las personas del seed. Solo desarrollo. */
export const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "Langopia-demo-2026";

export async function seedCredentials(db: Db): Promise<number> {
  const people = await db
    .select({ id: s.users.id, email: s.users.email, name: s.users.name })
    .from(s.users);

  if (people.length === 0) return 0;

  // Un solo hash para todas: scrypt es caro a propósito y hacerlo una vez por
  // persona convertiría el seed en un minuto de espera sin ganar nada.
  const hash = await hashPassword(SEED_PASSWORD);
  const now = new Date();

  for (const person of people) {
    const authUserId = randomUUID();
    await db.insert(s.authUsers).values({
      id: authUserId,
      name: person.name,
      email: person.email,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(s.authAccounts).values({
      id: randomUUID(),
      accountId: authUserId,
      providerId: "credential",
      userId: authUserId,
      password: hash,
      createdAt: now,
      updatedAt: now,
    });
    // El puente, desde el principio. Se hace por `id` de la persona, no por
    // correo: aquí ya se sabe de quién es la credencial que se acaba de crear.
    await db
      .update(s.users)
      .set({ authUserId })
      .where(eq(s.users.id, person.id));
  }

  return people.length;
}

/**
 * Comprueba que la credencial recién creada sirve de verdad.
 *
 * Una contraseña mal cifrada no se nota hasta que alguien intenta entrar, y
 * entonces parece un problema de Better Auth. Aquí se nota en el seed.
 */
export async function verifyCredentials(db: Db): Promise<void> {
  const { verifyPassword } = await import("better-auth/crypto");
  const [row] = await db
    .select({ password: s.authAccounts.password })
    .from(s.authAccounts)
    .limit(1);

  if (!row?.password) throw new Error("El seed no ha creado ninguna credencial.");
  if (!(await verifyPassword({ hash: row.password, password: SEED_PASSWORD }))) {
    throw new Error("La credencial creada por el seed no valida la contraseña esperada.");
  }

  const [pending] = await db
    .select({ n: sql<string>`count(*)::text` })
    .from(s.authUsers)
    .where(sql`"emailVerified" = false`);

  if (pending && pending.n !== "0") {
    throw new Error(`${pending.n} credenciales del seed sin verificar: no podrían iniciar sesión.`);
  }

  // Sin `auth_user_id` la credencial entra pero no lleva a ninguna escuela:
  // `memberships_for_auth_user` no encuentra nada y la respuesta es «No
  // perteneces a ninguna escuela». Es un fallo silencioso perfecto —el inicio
  // de sesión devuelve 200— así que se comprueba aquí, no en la primera demo.
  const [unlinked] = await db
    .select({ n: sql<string>`count(*)::text` })
    .from(s.users)
    .where(sql`${s.users.authUserId} IS NULL`);

  if (unlinked && unlinked.n !== "0") {
    throw new Error(
      `${unlinked.n} personas del seed sin credencial atada (users.auth_user_id a NULL): ` +
        "entrarían sin poder resolver ninguna escuela.",
    );
  }
}
