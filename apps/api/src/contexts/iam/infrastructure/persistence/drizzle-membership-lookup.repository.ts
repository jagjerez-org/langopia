import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type {
  MembershipLookupPort,
  MembershipRow,
} from "../../domain/ports/membership-lookup.port.js";

/**
 * La única lectura del sistema que ocurre fuera del `UnitOfWork`.
 *
 * Usa `connection` y no `db` a propósito: esta consulta averigua QUÉ escuela
 * hay que fijar, así que por definición se ejecuta antes de que haya ninguna.
 * Dentro de la transacción, sin `app.school_id`, RLS la dejaría vacía y nadie
 * podría entrar nunca.
 *
 * Por eso mismo no consulta las tablas directamente: `memberships` y `users`
 * tienen RLS con `FORCE`, y el rol `langopia_app` sin contexto no ve ni una
 * fila. La consulta vive en `memberships_for_auth_user`, una función
 * `SECURITY DEFINER` declarada en `packages/db/src/policies.sql` y con
 * `EXECUTE` concedido solo a `langopia_app`. Es un agujero en RLS del tamaño
 * exacto de esta tarea: recibe el identificador de una credencial y devuelve
 * las membresías activas de la persona atada a ella, nada más. El rol de la
 * aplicación sigue sin `BYPASSRLS`.
 *
 * El identificador llega de una sesión ya verificada por Better Auth. No hay
 * forma de pedirle las membresías de otra persona porque no hay ningún otro
 * parámetro — y, a diferencia de la versión por correo, tampoco hay forma de
 * fabricarse el parámetro: `user.id` lo genera Better Auth, no lo elige quien
 * se registra.
 */
@Injectable()
export class DrizzleMembershipLookupRepository implements MembershipLookupPort {
  constructor(private readonly drizzle: DrizzleService) {}

  async activeFor(authUserId: string): Promise<MembershipRow[]> {
    const rows = await this.drizzle.connection.execute<MembershipRow>(sql`
      SELECT "membershipId", "schoolId", "schoolSlug", "schoolLocale",
             "schoolStatus", role
      FROM memberships_for_auth_user(${authUserId})
    `);
    return [...rows];
  }
}
