import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ClsService } from "nestjs-cls";
import { PinoLogger } from "nestjs-pino";
import { UNIT_OF_WORK, type UnitOfWork } from "../shared/domain/ports/unit-of-work.port.js";
import { OBJECT_STORAGE } from "../shared/domain/ports/object-storage.port.js";
import {
  CLS_MEMBERSHIP_ID,
  CLS_SCHOOL_ID,
} from "../shared/infrastructure/tenant/cls-tenant-context.js";
import { AcceptInvitationHandler } from "./application/commands/accept-invitation/accept-invitation.handler.js";
import { EndImpersonationHandler } from "./application/commands/end-impersonation/end-impersonation.handler.js";
import { ErasePersonHandler } from "./application/commands/erase-person/erase-person.handler.js";
import { InviteMemberHandler } from "./application/commands/invite-member/invite-member.handler.js";
import { RegisterSchoolHandler } from "./application/commands/register-school/register-school.handler.js";
import { StartImpersonationHandler } from "./application/commands/start-impersonation/start-impersonation.handler.js";
import { UpdateSchoolSettingsHandler } from "./application/commands/update-school-settings/update-school-settings.handler.js";
import { PERSONAL_DATA_READ_MODEL } from "./application/ports/personal-data-read-model.port.js";
import { CheckSlugAvailabilityHandler } from "./application/queries/check-slug-availability/check-slug-availability.handler.js";
import { GetActiveImpersonationHandler } from "./application/queries/get-active-impersonation/get-active-impersonation.handler.js";
import { ExportPersonalDataHandler } from "./application/queries/export-personal-data/export-personal-data.handler.js";
import { GetSchoolSettingsHandler } from "./application/queries/get-school-settings/get-school-settings.handler.js";
import { ListImpersonationHistoryHandler } from "./application/queries/list-impersonation-history/list-impersonation-history.handler.js";
import { IMPERSONATION_AUDIT_READ_MODEL } from "./application/ports/impersonation-audit-read-model.port.js";
import { IDENTITY_PROVISIONING } from "./domain/ports/identity-provisioning.port.js";
import { IMPERSONATION_DIRECTORY } from "./domain/ports/impersonation-directory.port.js";
import { IMPERSONATION_REPOSITORY } from "./domain/ports/impersonation-repository.port.js";
import { INVITATION_REPOSITORY } from "./domain/ports/invitation-repository.port.js";
import { MEMBERSHIP_LOOKUP } from "./domain/ports/membership-lookup.port.js";
import { MINOR_GUARDIAN_LOOKUP } from "./domain/ports/minor-guardian-lookup.port.js";
import { PERSON_ERASURE_REPOSITORY } from "./domain/ports/person-erasure.port.js";
import { IAM_RECORDING_STORAGE } from "./domain/ports/recording-storage.port.js";
import { SCHOOL_REPOSITORY } from "./domain/ports/school-repository.port.js";
import { TRIAL_SUBSCRIPTION } from "./domain/ports/trial-subscription.port.js";
import { AUTH, createAuth } from "./infrastructure/auth/better-auth.config.js";
import { PeopleMinorGuardianAdapter } from "./infrastructure/acl/people-minor-guardian.adapter.js";
import { AuthController } from "./infrastructure/http/auth.controller.js";
import { ImpersonationController } from "./infrastructure/http/impersonation.controller.js";
import { McpOAuthController } from "./infrastructure/http/mcp-oauth.controller.js";
import { MeController } from "./infrastructure/http/me.controller.js";
import { PersonalDataController } from "./infrastructure/http/personal-data.controller.js";
import { SchoolsController } from "./infrastructure/http/schools.controller.js";
import { McpOAuthServer } from "./infrastructure/mcp/oauth-server.js";
import { DrizzleIdentityProvisioningRepository } from "./infrastructure/persistence/drizzle-identity-provisioning.repository.js";
import { DrizzleImpersonationAuditReadModel } from "./infrastructure/persistence/drizzle-impersonation-audit-read-model.js";
import { DrizzleImpersonationDirectoryRepository } from "./infrastructure/persistence/drizzle-impersonation-directory.repository.js";
import { DrizzleImpersonationRepository } from "./infrastructure/persistence/drizzle-impersonation.repository.js";
import { DrizzleInvitationRepository } from "./infrastructure/persistence/drizzle-invitation.repository.js";
import { DrizzleMembershipLookupRepository } from "./infrastructure/persistence/drizzle-membership-lookup.repository.js";
import { DrizzleMcpOAuthRepository } from "./infrastructure/persistence/drizzle-mcp-oauth.repository.js";
import { DrizzleMinorGuardianRepository } from "./infrastructure/persistence/drizzle-minor-guardian.repository.js";
import { DrizzlePersonalDataReadModel } from "./infrastructure/persistence/drizzle-personal-data-read-model.js";
import { DrizzlePersonErasureRepository } from "./infrastructure/persistence/drizzle-person-erasure.repository.js";
import { DrizzleSchoolRepository } from "./infrastructure/persistence/drizzle-school.repository.js";
import { DrizzleTrialSubscriptionRepository } from "./infrastructure/persistence/drizzle-trial-subscription.repository.js";

const commandHandlers = [
  RegisterSchoolHandler,
  InviteMemberHandler,
  AcceptInvitationHandler,
  ErasePersonHandler,
  StartImpersonationHandler,
  EndImpersonationHandler,
  UpdateSchoolSettingsHandler,
];
// Tarea 15 (RGPD): derecho de acceso y portabilidad. Tarea 17: estado de la
// impersonación activa para el aviso del panel, e historial para la
// pantalla de auditoría de la escuela. Tarea 12 del panel: disponibilidad
// del slug en vivo y ajustes de la escuela para el asistente de puesta en
// marcha.
const queryHandlers = [
  ExportPersonalDataHandler,
  GetActiveImpersonationHandler,
  ListImpersonationHistoryHandler,
  CheckSlugAvailabilityHandler,
  GetSchoolSettingsHandler,
];

@Module({
  controllers: [
    AuthController,
    SchoolsController,
    PersonalDataController,
    ImpersonationController,
    McpOAuthController,
    MeController,
  ],
  providers: [
    {
      provide: AUTH,
      // `PinoLogger` a secas (con `setContext`) y no `@InjectPinoLogger`:
      // Better Auth se construye con una función de fábrica (`createAuth`),
      // no una clase de Nest, y no hay dónde poner el decorador —el token
      // que genera solo existe si ALGUNA clase lo usa antes de que arranque
      // `LoggerModule`—. `PinoLogger` en sí es `Scope.TRANSIENT`: cada
      // inyección es una instancia propia, así que fijarle el contexto aquí
      // no afecta a ningún otro consumidor.
      inject: [ConfigService, PinoLogger],
      useFactory: (config: ConfigService, logger: PinoLogger) => {
        const url = config.get<string>("DATABASE_URL");
        if (!url) throw new Error("Falta DATABASE_URL para Better Auth");
        logger.setContext("BetterAuth");
        return createAuth(url, logger);
      },
    },
    DrizzleMembershipLookupRepository,
    { provide: MEMBERSHIP_LOOKUP, useExisting: DrizzleMembershipLookupRepository },
    DrizzleMcpOAuthRepository,
    {
      provide: McpOAuthServer,
      inject: [DrizzleMcpOAuthRepository, ConfigService, ClsService, UNIT_OF_WORK],
      useFactory: (
        repository: DrizzleMcpOAuthRepository,
        config: ConfigService,
        cls: ClsService,
        uow: UnitOfWork,
      ) => {
        const issuer = (
          config.get<string>("MCP_OAUTH_ISSUER") ??
          config.get<string>("PUBLIC_API_URL") ??
          config.get<string>("BETTER_AUTH_URL") ??
          "http://localhost:3000"
        ).replace(/\/api\/v1\/?$/, "");
        const tokenSecret =
          config.get<string>("MCP_OAUTH_TOKEN_SECRET") ??
          config.get<string>("BETTER_AUTH_SECRET") ??
          "langopia-mcp-oauth-dev-secret";
        if (process.env.NODE_ENV === "production" && tokenSecret === "langopia-mcp-oauth-dev-secret") {
          throw new Error("Falta MCP_OAUTH_TOKEN_SECRET para firmar tokens MCP en producción.");
        }
        return new McpOAuthServer(repository, {
          issuer,
          tokenSecret,
          withTenant: (context, work) =>
            cls.runWith(
              {
                ...cls.get(),
                [CLS_SCHOOL_ID]: context.schoolId,
                [CLS_MEMBERSHIP_ID]: context.membershipId,
              },
              () => uow.execute(work),
            ),
        });
      },
    },
    ...commandHandlers,
    DrizzleSchoolRepository,
    { provide: SCHOOL_REPOSITORY, useExisting: DrizzleSchoolRepository },
    DrizzleInvitationRepository,
    { provide: INVITATION_REPOSITORY, useExisting: DrizzleInvitationRepository },
    DrizzleIdentityProvisioningRepository,
    { provide: IDENTITY_PROVISIONING, useExisting: DrizzleIdentityProvisioningRepository },
    DrizzleTrialSubscriptionRepository,
    { provide: TRIAL_SUBSCRIPTION, useExisting: DrizzleTrialSubscriptionRepository },
    ...queryHandlers,
    DrizzlePersonalDataReadModel,
    { provide: PERSONAL_DATA_READ_MODEL, useExisting: DrizzlePersonalDataReadModel },
    DrizzlePersonErasureRepository,
    { provide: PERSON_ERASURE_REPOSITORY, useExisting: DrizzlePersonErasureRepository },
    // Ver `object-storage.port.ts`: antes de la tarea 4 de la ola 2 esto se
    // ataba a un noop que nunca borraba nada de verdad (deuda anotada en el
    // saneamiento post-ola-0); ahora resuelve contra el almacén de objetos
    // compartido (`shared`, `@Global()`).
    { provide: IAM_RECORDING_STORAGE, useExisting: OBJECT_STORAGE },
    DrizzleImpersonationDirectoryRepository,
    { provide: IMPERSONATION_DIRECTORY, useExisting: DrizzleImpersonationDirectoryRepository },
    DrizzleImpersonationRepository,
    { provide: IMPERSONATION_REPOSITORY, useExisting: DrizzleImpersonationRepository },
    DrizzleMinorGuardianRepository,
    PeopleMinorGuardianAdapter,
    { provide: MINOR_GUARDIAN_LOOKUP, useExisting: PeopleMinorGuardianAdapter },
    DrizzleImpersonationAuditReadModel,
    { provide: IMPERSONATION_AUDIT_READ_MODEL, useExisting: DrizzleImpersonationAuditReadModel },
  ],
  // `AUTH` y `MEMBERSHIP_LOOKUP` salen de aquí porque los necesita el
  // `SessionTenantGuard`, que se registra como guardia global en
  // `app.module.ts` y por tanto se construye en el inyector de la aplicación.
  // `IMPERSONATION_DIRECTORY` (Tarea 17), por el mismo motivo: el guardia
  // también lo necesita, para saber si la credencial de esta petición tiene
  // una impersonación activa.
  exports: [AUTH, MEMBERSHIP_LOOKUP, IMPERSONATION_DIRECTORY, McpOAuthServer],
})
export class IamModule {}
