import { Inject, Injectable } from "@nestjs/common";
import { ClsService } from "nestjs-cls";
import { sql } from "drizzle-orm";
import type { UnitOfWork } from "../../domain/ports/unit-of-work.port.js";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../domain/ports/tenant-context.port.js";
import { CLS_TRANSACTION, DrizzleService, type DrizzleDb } from "./drizzle.service.js";

/**
 * Unidad de trabajo sobre Postgres.
 *
 * Hace dos cosas en el mismo sitio, y no es casualidad:
 *
 *   1. Abre la transacción y la deja disponible para los repositorios.
 *   2. Fija el contexto de escuela con `set_config(..., true)` para que las
 *      políticas RLS sepan de quién son los datos.
 *
 * Que vayan juntas es la garantía de que no existe una transacción sin
 * tenant. El tercer parámetro `true` hace la variable local a la transacción:
 * al terminar desaparece, y la siguiente petición que reutilice esa conexión
 * del pool no hereda la escuela de la anterior. Sin ese `true`, un pool
 * ocupado filtra datos entre clientes.
 *
 * Las transacciones anidadas se reutilizan en lugar de abrir una nueva: si un
 * caso de uso llama a otro, siguen siendo una sola operación atómica.
 */
@Injectable()
export class DrizzleUnitOfWork implements UnitOfWork {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly cls: ClsService,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  /**
   * Ejecuta lecturas con el tenant fijado.
   *
   * El lado de consulta de CQRS no modifica nada, pero SÍ necesita que
   * `app.school_id` esté puesto: sin él las políticas RLS no dejan ver
   * ninguna fila y la consulta devuelve vacío en silencio, que es la peor
   * forma posible de fallar —parece que no hay datos, no que falte el
   * contexto.
   *
   * Se apoya en la misma transacción que las escrituras. Una transacción de
   * solo lectura es barata, y así existe un único punto donde se fija el
   * tenant en lugar de dos que puedan divergir.
   */
  async read<T>(work: () => Promise<T>): Promise<T> {
    return this.execute(work);
  }

  async execute<T>(work: () => Promise<T>): Promise<T> {
    const existing = this.cls.get<DrizzleDb | undefined>(CLS_TRANSACTION);
    if (existing) return work();

    const schoolId = this.tenant.schoolId();
    const membershipId = this.tenant.membershipId() ?? "";

    return this.drizzle.connection.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.school_id', ${schoolId}, true)`);
      await tx.execute(sql`SELECT set_config('app.membership_id', ${membershipId}, true)`);

      return this.cls.runWith(
        { ...this.cls.get(), [CLS_TRANSACTION]: tx as unknown as DrizzleDb },
        work,
      );
    });
  }
}
