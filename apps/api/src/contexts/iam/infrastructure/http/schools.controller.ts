import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import type { Request } from "express";
import { DomainError } from "../../../shared/domain/errors/domain-error.js";
import { Public, Roles, RestrictedWhileImpersonating } from "../../../shared/infrastructure/http/roles.decorator.js";
import { AcceptInvitationCommand } from "../../application/commands/accept-invitation/accept-invitation.command.js";
import { InviteMemberCommand } from "../../application/commands/invite-member/invite-member.command.js";
import { RegisterSchoolCommand } from "../../application/commands/register-school/register-school.command.js";
import { UpdateSchoolSettingsCommand } from "../../application/commands/update-school-settings/update-school-settings.command.js";
import { CheckSlugAvailabilityQuery } from "../../application/queries/check-slug-availability/check-slug-availability.handler.js";
import { GetSchoolSettingsQuery } from "../../application/queries/get-school-settings/get-school-settings.handler.js";
import { AUTH, type Auth } from "../auth/better-auth.config.js";
import { EmailNotVerifiedError } from "./session-tenant.guard.js";
import { InviteMemberDto, RegisterSchoolDto, UpdateSchoolSettingsDto } from "./dto/schools.dto.js";

/**
 * No hay sesión de Better Auth en absoluto: ni cookie, ni una que Better
 * Auth reconozca. Distinto de `EmailNotVerifiedError` —que sí identifica a
 * alguien, solo que sin confirmar—: aquí no hay nadie que identificar.
 */
export class AuthenticationRequiredError extends DomainError {
  readonly code = "authentication_required";
  readonly kind = "forbidden" as const;
  constructor() {
    super("Inicia sesión antes de continuar.");
  }
}

type BetterAuthSession = NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>;

/**
 * Adaptador de entrada sobre HTTP para el alta de escuelas e invitaciones.
 *
 * `register` y `accept` son las dos rutas que corren SIN tenant: por eso
 * llevan `@Public()` (`SessionTenantGuard` no intenta resolver escuela) y, a
 * la vez, necesitan una sesión de Better Auth verificada — la resuelven
 * ellas mismas, con el mismo patrón que ya usa `SessionTenantGuard`, porque
 * public y anónimo no son lo mismo: aquí hace falta saber QUIÉN, aunque
 * todavía no sepamos EN QUÉ escuela.
 */
@Controller()
export class SchoolsController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
    @Inject(AUTH) private readonly auth: Auth,
  ) {}

  /**
   * Aviso de disponibilidad en vivo (Tarea 12 del panel), ANTES de enviar el
   * formulario de alta. `@Public()`, igual que `register`: quien mira
   * todavía no tiene sesión resuelta en ninguna escuela — de hecho ni
   * siquiera hace falta que haya iniciado sesión para comprobar un slug.
   */
  @Public()
  @Get("schools/slug-availability")
  async slugAvailability(@Query("slug") slug: string) {
    return this.queries.execute(new CheckSlugAvailabilityQuery(slug ?? ""));
  }

  @Public()
  @Post("schools/register")
  async register(@Req() req: Request, @Body() dto: RegisterSchoolDto) {
    const session = await this.verifiedSessionFrom(req);
    return this.commands.execute(
      new RegisterSchoolCommand({
        slug: dto.slug,
        name: dto.name,
        ownerAuthUserId: session.user.id,
        ownerEmail: session.user.email,
        ownerName: session.user.name,
      }),
    );
  }

  /**
   * Ajustes de la escuela activa (Tarea 12 del panel): prellenar el
   * asistente de puesta en marcha y el aviso de días de prueba. Dentro de
   * tenant: quien pregunta ya es `owner`/`admin` de la escuela recién
   * registrada.
   */
  @Roles("owner", "admin")
  @Get("schools/me")
  async me() {
    return this.queries.execute(new GetSchoolSettingsQuery());
  }

  /**
   * "Marca" e "idiomas" del asistente de puesta en marcha (Tarea 12 del
   * panel). Sin `@RestrictedWhileImpersonating`: no está en la lista cerrada
   * de `FORBIDDEN_WHILE_IMPERSONATING` (no es credencial, dinero, datos
   * personales ni rol) y soporte ayudando a terminar la puesta en marcha de
   * una escuela nueva es un caso de uso legítimo.
   */
  @Roles("owner", "admin")
  @Patch("schools/me")
  async updateMe(@Body() dto: UpdateSchoolSettingsDto) {
    return this.commands.execute(
      new UpdateSchoolSettingsCommand({ name: dto.name, defaultLocale: dto.defaultLocale }),
    );
  }

  /**
   * Dentro de tenant: quien invita ya pertenece a la escuela.
   *
   * Tarea 17: invitar es conceder un rol — escalada por la puerta de atrás
   * si se permitiera mientras alguien impersona.
   */
  @Roles("owner", "admin")
  @RestrictedWhileImpersonating("role_management")
  @Post("schools/members/invite")
  async invite(@Body() dto: InviteMemberDto) {
    return this.commands.execute(new InviteMemberCommand({ email: dto.email, role: dto.role }));
  }

  @Public()
  @Post("invitations/:token/accept")
  async accept(@Param("token") token: string, @Req() req: Request) {
    const session = await this.verifiedSessionFrom(req);
    return this.commands.execute(
      new AcceptInvitationCommand({
        token,
        authUserId: session.user.id,
        email: session.user.email,
        name: session.user.name,
      }),
    );
  }

  private async verifiedSessionFrom(req: Request): Promise<BetterAuthSession> {
    const headers = new Headers();
    if (req.headers.cookie) headers.set("cookie", req.headers.cookie);
    const session = await this.auth.api.getSession({ headers });
    if (!session) throw new AuthenticationRequiredError();
    if (!session.user.emailVerified) throw new EmailNotVerifiedError();
    return session;
  }
}
