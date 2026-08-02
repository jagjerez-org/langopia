import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { ClsService } from "nestjs-cls";
import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@langopia/db/schema";
import { normalizeDatabaseUrl } from "./normalize-database-url.js";

export type DrizzleDb = PostgresJsDatabase<typeof schema>;

/** Clave con la que la transacción activa viaja por la petición. */
export const CLS_TRANSACTION = "drizzle:tx";

export const DATABASE_URL = Symbol("DATABASE_URL");

/**
 * Acceso a la base de datos.
 *
 * `db` devuelve la transacción en curso si la hay, y la conexión suelta si
 * no. Eso permite que un repositorio se escriba una sola vez y funcione
 * igual dentro y fuera de una unidad de trabajo, sin recibir la transacción
 * como parámetro por media aplicación.
 *
 * La conexión usa el rol `langopia_app`, SIN BYPASSRLS. Es la red de
 * seguridad: aunque una consulta se olvide de filtrar por escuela, Postgres
 * la filtra.
 */
@Injectable()
export class DrizzleService implements OnModuleDestroy {
  private readonly client: postgres.Sql;
  private readonly root: DrizzleDb;

  constructor(
    @Inject(DATABASE_URL) url: string,
    private readonly cls: ClsService,
  ) {
    this.client = postgres(normalizeDatabaseUrl(url), { max: 10, onnotice: () => {} });
    this.root = drizzle(this.client, { schema });
  }

  get db(): DrizzleDb {
    return this.cls.get<DrizzleDb | undefined>(CLS_TRANSACTION) ?? this.root;
  }

  /** Conexión base, sin transacción. Para trabajos de fondo y sondas de salud. */
  get connection(): DrizzleDb {
    return this.root;
  }

  get sql(): postgres.Sql {
    return this.client;
  }

  /** Comprueba que la base de datos responde. La usa la sonda de salud. */
  async ping(): Promise<void> {
    await this.root.execute(sql`SELECT 1`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.end({ timeout: 5 });
  }
}
