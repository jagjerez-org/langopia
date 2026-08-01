ALTER TABLE "users" ADD COLUMN "auth_user_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_auth_user_id_user_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_auth_user_id_uq" ON "users" USING btree ("auth_user_id");--> statement-breakpoint
-- Relleno de las cuentas que ya existen.
--
-- El puente entre `user` (Better Auth) y `users` (Langopia) era hasta ahora el
-- correo, así que esta es la ÚNICA vez que se usa para atarlos: a partir de
-- aquí el vínculo es `auth_user_id` y el correo vuelve a ser un dato editable.
-- La correspondencia es 1:1 sin ambigüedad posible —`user.email` es único y
-- `users` tiene índice único sobre `lower(email)`—, y si alguna vez dejara de
-- serlo el índice único de la columna haría fallar la migración en vez de
-- dejar dos personas compartiendo credencial.
--
-- Quien no tenga credencial se queda a NULL: existe como persona del dominio,
-- pero todavía no tiene con qué entrar.
UPDATE "users" u
   SET "auth_user_id" = a."id"
  FROM "user" a
 WHERE lower(a."email") = lower(u."email")
   AND u."auth_user_id" IS NULL;
