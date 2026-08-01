import { index, pgTable, boolean, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Tablas de Better Auth.
 *
 * Better Auth trae su propio esquema (`user`, `session`, `account`,
 * `verification`) y lo comprueba al arrancar. Se declara aquí, y no se deja
 * que la librería lo cree por su cuenta, por dos motivos:
 *
 *   1. `db:push` borra toda tabla que no esté en este esquema. Si estas
 *      vivieran fuera, un `db:reset` en desarrollo se llevaría por delante
 *      las credenciales.
 *   2. Desde la Tarea 4 el esquema entra por migración versionada. Una tabla
 *      creada a mano por un CLI no aparece en `drizzle/`.
 *
 * La definición es la que genera el propio Better Auth
 * (`getMigrations(auth.options)`), traducida a Drizzle sin cambiar ni un tipo
 * ni un nombre de columna: los nombres van en camelCase porque así los busca
 * la librería.
 *
 * Son tablas GLOBALES: no llevan `school_id` a propósito. Guardan la
 * credencial de una persona, y una persona puede dar clase en dos escuelas.
 * El puente con `users` de Langopia es `users.auth_user_id`, que apunta a
 * `user.id` con clave foránea única. El aislamiento entre escuelas lo resuelve
 * `memberships`, no esta tabla. Su tratamiento en `policies.sql` está en la
 * sección de tablas globales.
 */
export const authUsers = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull(),
  image: text("image"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

export const authSessions = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_userId_idx").on(t.userId)],
);

export const authAccounts = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { withTimezone: true }),
    scope: text("scope"),
    /** Hash de la contraseña. Solo lo escribe Better Auth. */
    password: text("password"),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull(),
  },
  (t) => [index("account_userId_idx").on(t.userId)],
);

export const authVerifications = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);
