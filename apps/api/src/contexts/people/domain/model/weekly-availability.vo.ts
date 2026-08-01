import { DomainError } from "../../../shared/domain/errors/domain-error.js";
import { ValueObject } from "../../../shared/domain/primitives/value-object.js";

export class InvalidAvailabilitySlotError extends DomainError {
  readonly code = "invalid_availability_slot";
  readonly kind = "invalid_input" as const;
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, details);
  }
}

export class OverlappingAvailabilityError extends DomainError {
  readonly code = "overlapping_availability";
  readonly kind = "invariant_violation" as const;
  constructor(weekday: number) {
    super("Esta franja de disponibilidad se solapa con otra del mismo día.", { weekday });
  }
}

const MINUTES_PER_DAY = 24 * 60;

/** 1 = lunes … 7 = domingo (ISO-8601), igual que `teacher_availability`. */
export type AvailabilitySlot = {
  weekday: number;
  startMinute: number;
  endMinute: number;
};

/**
 * Disponibilidad semanal recurrente de un profesor.
 *
 * Se guarda en minutos desde medianoche, igual que la tabla
 * `teacher_availability` (ver `DrizzleTeacherAvailabilityRepository`, en
 * `scheduling`): la zona horaria de la escuela es un detalle de esa consulta,
 * no de este objeto de valor. `of()` sustituye siempre el conjunto completo —
 * no hay un `addSlot()` que acumule—, porque `PUT
 * /teachers/:id/availability` reemplaza la semana entera, no la combina con
 * la anterior.
 */
export class WeeklyAvailability extends ValueObject<{ slots: AvailabilitySlot[] }> {
  private constructor(slots: AvailabilitySlot[]) {
    super({ slots });
  }

  static of(rawSlots: AvailabilitySlot[]): WeeklyAvailability {
    const slots = rawSlots.map((slot) => WeeklyAvailability.validate(slot));

    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i]!;
        const b = slots[j]!;
        // Igual que `TimeSlot.overlaps`: tocarse no cuenta como solape.
        if (a.weekday === b.weekday && a.startMinute < b.endMinute && b.startMinute < a.endMinute) {
          throw new OverlappingAvailabilityError(a.weekday);
        }
      }
    }

    return new WeeklyAvailability(slots);
  }

  private static validate(slot: AvailabilitySlot): AvailabilitySlot {
    if (!Number.isInteger(slot.weekday) || slot.weekday < 1 || slot.weekday > 7) {
      throw new InvalidAvailabilitySlotError(
        "El día de la semana debe ser un valor ISO-8601, de 1 (lunes) a 7 (domingo).",
        { weekday: slot.weekday },
      );
    }
    if (
      !Number.isInteger(slot.startMinute) ||
      !Number.isInteger(slot.endMinute) ||
      slot.startMinute < 0 ||
      slot.endMinute > MINUTES_PER_DAY ||
      slot.endMinute <= slot.startMinute
    ) {
      throw new InvalidAvailabilitySlotError(
        "La franja horaria no es válida: debe empezar antes de acabar y caber en un día.",
        { startMinute: slot.startMinute, endMinute: slot.endMinute },
      );
    }
    return { weekday: slot.weekday, startMinute: slot.startMinute, endMinute: slot.endMinute };
  }

  get slots(): readonly AvailabilitySlot[] {
    return this.props.slots;
  }
}
