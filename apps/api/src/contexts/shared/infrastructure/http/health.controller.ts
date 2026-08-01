import { Controller, Get } from "@nestjs/common";
import { Public } from "./roles.decorator.js";
import { DrizzleService } from "../persistence/drizzle.service.js";

@Controller("health")
export class HealthController {
  constructor(private readonly drizzle: DrizzleService) {}

  /**
   * Comprueba que la base de datos responde, no solo que el proceso vive.
   * Un proceso arriba con la base caída es peor que un proceso caído: el
   * balanceador le sigue mandando tráfico.
   *
   * El SQL en sí vive en `DrizzleService.ping()` (infrastructure/persistence):
   * la guardia de arquitectura exige que ningún otro sitio lo escriba.
   */
  @Public()
  @Get()
  async check() {
    await this.drizzle.ping();
    return { status: "ok", at: new Date().toISOString() };
  }
}
