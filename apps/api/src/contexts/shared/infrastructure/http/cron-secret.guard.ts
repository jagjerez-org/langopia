import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";
import type { Request } from "express";

/**
 * Protege las rutas `cron/*` que Vercel Cron llama con una petición HTTP.
 *
 * Las rutas son `@Public()` —no hay sesión de usuario que comprobar, igual
 * que cuando `@nestjs/schedule` dispara el trabajo dentro del proceso—, así
 * que el único control de acceso es el secreto compartido: Vercel firma sus
 * llamadas de cron con `Authorization: Bearer ${CRON_SECRET}` cuando la
 * variable existe. Sin `CRON_SECRET` configurado la ruta no puede ser
 * legítima, así que se rechaza con un 500 nuestro (falta configuración), no
 * con un 401 que insinuara que la petición era mala — mismo criterio que el
 * webhook de Stripe sin `STRIPE_WEBHOOK_SECRET`.
 *
 * La comparación es de tiempo constante: con `===` la respuesta tardaría un
 * pelo menos cuanto más corto sea el prefijo acertado, y eso filtra el
 * secreto byte a byte.
 */
@Injectable()
export class CronSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      throw new ServiceUnavailableException("cron_not_configured");
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers.authorization ?? "";
    const expected = `Bearer ${secret}`;
    const matches =
      provided.length === expected.length &&
      timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
    if (!matches) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
