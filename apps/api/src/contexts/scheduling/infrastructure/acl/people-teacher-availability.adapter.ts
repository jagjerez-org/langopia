import { Injectable } from "@nestjs/common";
import type { TeacherId } from "../../domain/model/identifiers.js";
import type { TimeSlot } from "../../domain/model/time-slot.vo.js";
import type { TeacherAvailabilityPort } from "../../domain/ports/teacher-availability.port.js";
import { DrizzleTeacherAvailabilityRepository } from "../persistence/drizzle-teacher-availability.repository.js";

/**
 * Capa anticorrupción hacia el contexto de Personas.
 *
 * Scheduling necesita tres datos del profesorado y no debe saber nada más. En
 * lugar de importar el agregado `TeacherProfile` de otro contexto —lo que
 * ataría el calendario a cada cambio de la ficha del profesor— este adaptador
 * traduce el modelo ajeno a las tres preguntas que aquí importan.
 *
 * El acceso a datos vive en `DrizzleTeacherAvailabilityRepository`
 * (`infrastructure/persistence/`): este adaptador delega, no escribe SQL. El
 * día que Personas sea un servicio aparte, se cambia el repositorio por
 * llamadas HTTP y no se toca nada más: ni el dominio, ni los manejadores, ni
 * las pruebas.
 */
@Injectable()
export class PeopleTeacherAvailabilityAdapter implements TeacherAvailabilityPort {
  constructor(private readonly repository: DrizzleTeacherAvailabilityRepository) {}

  isActive(teacherId: TeacherId): Promise<boolean> {
    return this.repository.isActive(teacherId);
  }

  coversSlot(teacherId: TeacherId, slot: TimeSlot): Promise<boolean> {
    return this.repository.coversSlot(teacherId, slot);
  }

  contractedHoursPerWeek(teacherId: TeacherId): Promise<number | null> {
    return this.repository.contractedHoursPerWeek(teacherId);
  }
}
