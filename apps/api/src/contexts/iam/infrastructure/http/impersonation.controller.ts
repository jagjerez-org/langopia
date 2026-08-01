import { Body, Controller, Delete, Get, Inject, Post, Req } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import type { Request } from "express";
import { DomainError } from "../../../shared/domain/errors/domain-error.js";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../shared/domain/ports/tenant-context.port.js";
import { Public, Roles } from "../../../shared/infrastructure/http/roles.decorator.js";
import { MEMBERSHIP_ROLES } from "../../domain/model/invitation.aggregate.js";
import { EndImpersonationCommand } from "../../application/commands/end-impersonation/end-impersonation.command.js";
import { StartImpersonationCommand } from "../../application/commands/start-impersonation/start-impersonation.command.js";
import { GetActiveImpersonationQuery } from "../../application/queries/get-active-impersonation/get-active-impersonation.handler.js";
import { ListImpersonationHistoryQuery } from "../../application/queries/list-impersonation-history/list-impersonation-history.handler.js";
import { AUTH, type Auth } from "../auth/better-auth.config.js";
import { AuthenticationRequiredError } from "./schools.controller.js";
import { EmailNotVerifiedError } from "./session-tenant.guard.js";
import { StartImpersonationDto } from "./dto/impersonation.dto.js";

type BetterAuthSession = NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>;

/** No hay impersonación activa en esta sesión: nada que terminar ni que enseñar. */
export class NoActiveImpersonationError extends DomainError {
  readonly code = "impersonation_not_active";
  readonly kind = "not_found" as const;
  constructor() {
    super("No tienes ninguna impersonación activa.");
  }
}

/**
 * Adaptador de ENTRADA sobre HTTP para la impersonación de soporte (Tarea 17).
 *
 * `start` es `@Public()` frente a `SessionTenantGuard` a propósito: soporte
 * de la plataforma puede no tener membresía en NINGUNA escuela, así que la
 * resolución normal de tenant (que exige al menos una) le rechazaría antes
 * de llegar aquí. En su lugar resuelve la sesión de Better Auth a mano —
 * mismo patrón que `SchoolsController.register`—, y es
 * `StartImpersonationHandler` quien decide, con `assertCanImpersonate`, si
 * esa credencial puede impersonar a la membresía pedida. `@Public()` no
 * significa «sin autenticar»: significa «sin tenant resuelto por el
 * guardia», y `verifiedSessionFrom` sigue exigiendo una sesión con el correo
 * verificado.
 *
 * `end` y `get` SÍ son rutas normales: para cuando se llaman, si hay una
 * impersonación activa, `SessionTenantGuard` ya ha fijado el tenant de la
 * persona impersonada y `CLS_IMPERSONATION_ID` con el identificador que
 * necesitan.
 */
@Controller("iam/impersonation")
export class ImpersonationController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(AUTH) private readonly auth: Auth,
  ) {}

  @Public()
  @Post()
  async start(@Req() req: Request, @Body() dto: StartImpersonationDto) {
    const session = await this.verifiedSessionFrom(req);
    return this.commands.execute(
      new StartImpersonationCommand({
        targetMembershipId: dto.targetMembershipId,
        reason: dto.reason,
        actorAuthUserId: session.user.id,
        actorEmail: session.user.email,
        actorName: session.user.name,
      }),
    );
  }

  /**
   * `end` y `current` los llama quien está impersonando, pero con los roles
   * de la persona IMPERSONADA: `SessionTenantGuard` fija `CLS_ROLES` a
   * `[targetRole]`, y ese destino puede ser cualquiera de los cinco. Por eso
   * los cinco, y no `owner`/`admin`: exigir rango de dirección aquí dejaría a
   * soporte sin poder cerrar la impersonación de un alumno que él mismo
   * abrió. Lo que estas dos rutas dejan ver es la impersonación de la propia
   * sesión, nada de otras.
   */
  @Roles(...MEMBERSHIP_ROLES)
  @Delete()
  async end() {
    const impersonationId = this.tenant.impersonationId?.();
    if (!impersonationId) throw new NoActiveImpersonationError();
    return this.commands.execute(new EndImpersonationCommand({ impersonationId }));
  }

  @Roles(...MEMBERSHIP_ROLES)
  @Get()
  async current() {
    return this.queries.execute(new GetActiveImpersonationQuery());
  }

  /**
   * Paso 12 del brief: que la escuela pueda auditarte es lo que separa esto
   * de una puerta trasera. `owner`/`admin` solamente — es el mismo rastro
   * sensible que decide quién ha actuado como quién dentro de su escuela.
   */
  @Roles("owner", "admin")
  @Get("history")
  async history() {
    return this.queries.execute(new ListImpersonationHistoryQuery());
  }

  /**
   * Duplicado a propósito, y pequeño: el mismo helper de
   * `SchoolsController.verifiedSessionFrom`. Extraerlo a un sitio compartido
   * es una mejora legítima, pero no de esta tarea — tocar ese controlador
   * más de lo imprescindible es justo lo que la advertencia de concurrencia
   * de la ola pide evitar.
   */
  private async verifiedSessionFrom(req: Request): Promise<BetterAuthSession> {
    const headers = new Headers();
    if (req.headers.cookie) headers.set("cookie", req.headers.cookie);
    const session = await this.auth.api.getSession({ headers });
    if (!session) throw new AuthenticationRequiredError();
    if (!session.user.emailVerified) throw new EmailNotVerifiedError();
    return session;
  }
}
