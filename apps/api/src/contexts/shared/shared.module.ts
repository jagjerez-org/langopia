import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { CqrsModule } from "@nestjs/cqrs";
import { AUDIT_LOG } from "./domain/ports/audit-log.port.js";
import { CLOCK } from "./domain/ports/clock.port.js";
import { EVENT_PUBLISHER } from "./domain/ports/event-publisher.port.js";
import { ID_GENERATOR } from "./domain/ports/id-generator.port.js";
import { OBJECT_STORAGE } from "./domain/ports/object-storage.port.js";
import { TENANT_CONTEXT } from "./domain/ports/tenant-context.port.js";
import { UNIT_OF_WORK } from "./domain/ports/unit-of-work.port.js";
import { HealthController } from "./infrastructure/http/health.controller.js";
import { NestEventPublisher } from "./infrastructure/messaging/nest-event-publisher.js";
import { DrizzleAuditLogRepository } from "./infrastructure/persistence/drizzle-audit-log.repository.js";
import { DrizzleUnitOfWork } from "./infrastructure/persistence/drizzle-unit-of-work.js";
import { DATABASE_URL, DrizzleService } from "./infrastructure/persistence/drizzle.service.js";
import { S3ObjectStorageAdapter } from "./infrastructure/storage/s3-object-storage.adapter.js";
import { SystemClock, UuidGenerator } from "./infrastructure/system/system.adapters.js";
import { ClsTenantContext } from "./infrastructure/tenant/cls-tenant-context.js";

/**
 * Aquí es donde los puertos se atan a sus adaptadores.
 *
 * Este es el ÚNICO fichero que conoce ambos lados. Un manejador de comando
 * pide `UNIT_OF_WORK` y recibe una implementación sobre Postgres sin saberlo;
 * sustituirla por otra en una prueba es cambiar una línea aquí.
 */
@Global()
@Module({
  imports: [ConfigModule, CqrsModule],
  controllers: [HealthController],
  providers: [
    {
      provide: DATABASE_URL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>("DATABASE_URL_APP");
        if (!url) {
          throw new Error(
            "Falta DATABASE_URL_APP. La API debe conectarse con el rol langopia_app, " +
              "que no tiene BYPASSRLS: es lo que impide una fuga entre escuelas.",
          );
        }
        return url;
      },
    },
    DrizzleService,
    ClsTenantContext,
    { provide: TENANT_CONTEXT, useExisting: ClsTenantContext },
    { provide: UNIT_OF_WORK, useClass: DrizzleUnitOfWork },
    { provide: EVENT_PUBLISHER, useClass: NestEventPublisher },
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: UuidGenerator },
    { provide: AUDIT_LOG, useClass: DrizzleAuditLogRepository },
    { provide: OBJECT_STORAGE, useClass: S3ObjectStorageAdapter },
  ],
  exports: [
    DrizzleService,
    ClsTenantContext,
    TENANT_CONTEXT,
    UNIT_OF_WORK,
    EVENT_PUBLISHER,
    CLOCK,
    ID_GENERATOR,
    AUDIT_LOG,
    OBJECT_STORAGE,
    CqrsModule,
  ],
})
export class SharedModule {}
