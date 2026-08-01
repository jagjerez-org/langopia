import { Injectable } from "@nestjs/common";
import type { SchoolCalendarPort } from "../../domain/ports/school-calendar.port.js";
import { DrizzleSchoolTimezoneRepository } from "../persistence/drizzle-school-timezone.repository.js";

const DEFAULT_TIMEZONE = "Europe/Madrid";

/**
 * Capa anticorrupción hacia el contexto de tenants: la zona horaria vive en
 * `schools`, no en `learning`.
 *
 * `today()` no le pregunta la hora al sistema: recibe el instante ya resuelto
 * (`Clock.now()`, inyectado por quien llama) y solo traduce «este instante» a
 * «qué día de calendario es en la zona horaria de la escuela», con el mismo
 * formato (`YYYY-MM-DD`) que exige la columna `due_on`. `Intl.DateTimeFormat`
 * con locale `en-CA` produce ese formato exacto sin tener que ensamblarlo a
 * mano — es el mismo truco que usa la comprobación en vivo de esta tarea (ver
 * el informe): a las 23:30 UTC, Madrid ya está en el día siguiente y Nueva
 * York todavía no, y es justo esa diferencia la que decide si una tarjeta
 * vence hoy o mañana.
 */
@Injectable()
export class SchoolCalendarAdapter implements SchoolCalendarPort {
  constructor(private readonly repository: DrizzleSchoolTimezoneRepository) {}

  async today(now: Date): Promise<string> {
    const timezone = (await this.repository.timezone()) ?? DEFAULT_TIMEZONE;
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
  }
}
