import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { ClsModule } from "nestjs-cls";
import { AssessmentModule } from "./contexts/assessment/assessment.module.js";
import { BillingModule } from "./contexts/billing/billing.module.js";
import { CatalogModule } from "./contexts/catalog/catalog.module.js";
import { ClassroomModule } from "./contexts/classroom/classroom.module.js";
import { FeedbackModule } from "./contexts/feedback/feedback.module.js";
import { IamModule } from "./contexts/iam/iam.module.js";
import { LearningModule } from "./contexts/learning/learning.module.js";
import { NotificationsModule } from "./contexts/notifications/notifications.module.js";
import { PeopleModule } from "./contexts/people/people.module.js";
import { PortalModule } from "./contexts/portal/portal.module.js";
import { SchedulingModule } from "./contexts/scheduling/scheduling.module.js";
import { SharedModule } from "./contexts/shared/shared.module.js";
import { SitesModule } from "./contexts/sites/sites.module.js";
import { AllExceptionsFilter } from "./contexts/shared/infrastructure/http/all-exceptions.filter.js";
import { AuthenticatedGuard } from "./contexts/iam/infrastructure/http/authenticated.guard.js";
import { SessionTenantGuard } from "./contexts/iam/infrastructure/http/session-tenant.guard.js";
import { McpOAuthServer } from "./contexts/iam/infrastructure/mcp/oauth-server.js";
import { MCP_ACCESS_TOKEN_VERIFIER } from "./entrypoints/mcp/mcp-auth.port.js";
import { McpController } from "./entrypoints/mcp/mcp.controller.js";
import { McpToolsService } from "./entrypoints/mcp/tools/mcp-tools.service.js";
// Importado EL ÚLTIMO, y no es cosmético: `nestjs-pino` registra el
// proveedor de cada `@InjectPinoLogger(Contexto)` en el momento en que
// `LoggerModule.forRootAsync(...)` se evalúa, y solo ve los decoradores que
// YA se han ejecutado —es decir, los ficheros que Node ya ha cargado—. Si
// este import fuera antes que el de `SessionTenantGuard` o el de
// `AllExceptionsFilter`, sus decoradores todavía no habrían corrido y Nest
// fallaría en el arranque con «no se puede resolver PinoLogger:X». Puesto el
// último, para cuando se evalúa ya se ha cargado todo lo demás en este
// fichero y, transitivamente, cada contexto (`BillingModule`,
// `ClassroomModule`...) con sus propios usos del decorador.
import { LoggerModule } from "./contexts/shared/infrastructure/logging/logger.module.js";

/**
 * Composición de la aplicación.
 *
 * Un módulo por contexto acotado. Ninguno importa a otro: se comunican por
 * eventos a través del bus, o por puertos con su adaptador en infraestructura.
 * Si algún día aparece aquí `imports: [SchedulingModule]` dentro de otro
 * contexto, la frontera se ha roto.
 */
@Module({
  imports: [
    // El `.env` vive en la raíz del monorepo: es la misma base de datos para
    // la API y para las herramientas del paquete de datos.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [".env", "../../.env"] }),
    // Almacenamiento por petición: transporta el tenant y la transacción sin
    // que haya que pasarlos como parámetro por toda la aplicación.
    ClsModule.forRoot({ global: true, middleware: { mount: true } }),
    // Registro único (Tarea 8c). Su posición AQUÍ, en el array, es
    // irrelevante en tiempo de ejecución —lo que importa es el `import`
    // estático de arriba, ver el comentario junto a él—.
    LoggerModule,
    // Dispara los trabajos con `@Cron(...)` (hoy solo la purga RGPD de
    // `classroom`). No tiene sesión ni petición HTTP: cada trabajo fija su
    // propio tenant antes de tocar datos.
    ScheduleModule.forRoot(),
    SharedModule,
    IamModule,
    PeopleModule,
    CatalogModule,
    SchedulingModule,
    BillingModule,
    FeedbackModule,
    ClassroomModule,
    // Contenido y generación con IA (tarea 6 de la ola 2: caso de uso
    // completo de generación). Antes de `AssessmentModule`: `assessment`
    // consulta `exercises`/`rubrics` por su propio puerto
    // (`ExerciseSourcePort`), no importa nada de aquí, pero las dos
    // pertenecen al mismo tramo de la ola.
    LearningModule,
    // Valoración del alumno por el profesor (Tarea 16): se apoya en
    // `scheduling` y `people` por puerto, nunca importando su agregado.
    AssessmentModule,
    // Puro lado de lectura sobre lo que ya construyeron los de arriba: el
    // panel de dirección y el portal del alumno (Tarea 9).
    PortalModule,
    // Solo escucha eventos de los de arriba (y un trabajo programado): no
    // expone rutas propias, así que no cambia el orden de las guardias.
    NotificationsModule,
    SitesModule,
  ],
  controllers: [McpController],
  providers: [
    McpToolsService,
    { provide: MCP_ACCESS_TOKEN_VERIFIER, useExisting: McpOAuthServer },
    // Orden importante: las guardias se ejecutan en el orden en que se
    // registran. `SessionTenantGuard` tiene que fijar la escuela ANTES de que
    // `AuthenticatedGuard` compruebe el rol; si viviera en la fase de
    // interceptores (que corre después de todas las guardias) llegaría
    // siempre tarde y toda petición autenticada vería `missing_tenant`.
    { provide: APP_GUARD, useClass: SessionTenantGuard },
    { provide: APP_GUARD, useClass: AuthenticatedGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
