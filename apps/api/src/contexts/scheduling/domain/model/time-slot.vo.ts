import { ValueObject } from "../../../shared/domain/primitives/value-object.js";
import { InvalidTimeSlotError } from "../errors/scheduling.errors.js";

const MIN_MINUTES = 15;
/** Cuatro horas. Por encima de eso es un curso intensivo, no una clase. */
const MAX_MINUTES = 240;

/**
 * Franja horaria de una clase.
 *
 * Se guarda siempre en UTC. La zona horaria es un asunto de presentación: la
 * escuela de São Paulo y la de Berlín ven horas distintas para el mismo
 * instante, y una clase no se mueve porque cambie el horario de verano.
 */
export class TimeSlot extends ValueObject<{ start: Date; end: Date }> {
  private constructor(start: Date, end: Date) {
    super({ start, end });
  }

  static of(start: Date, end: Date): TimeSlot {
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new InvalidTimeSlotError("alguna de las fechas no es válida");
    }
    if (end <= start) {
      throw new InvalidTimeSlotError("la hora de fin no es posterior a la de inicio", {
        start: start.toISOString(),
        end: end.toISOString(),
      });
    }
    const minutes = (end.getTime() - start.getTime()) / 60_000;
    if (minutes < MIN_MINUTES) {
      throw new InvalidTimeSlotError(`una clase no puede durar menos de ${MIN_MINUTES} minutos`, {
        minutes,
      });
    }
    if (minutes > MAX_MINUTES) {
      throw new InvalidTimeSlotError(`una clase no puede durar más de ${MAX_MINUTES} minutos`, {
        minutes,
      });
    }
    return new TimeSlot(new Date(start), new Date(end));
  }

  static fromDuration(start: Date, minutes: number): TimeSlot {
    return TimeSlot.of(start, new Date(start.getTime() + minutes * 60_000));
  }

  get start(): Date {
    return this.props.start;
  }

  get end(): Date {
    return this.props.end;
  }

  get durationMinutes(): number {
    return (this.props.end.getTime() - this.props.start.getTime()) / 60_000;
  }

  /** Dos franjas se solapan si comparten algún instante. Tocarse no cuenta. */
  overlaps(other: TimeSlot): boolean {
    return this.props.start < other.props.end && other.props.start < this.props.end;
  }

  startsAfter(instant: Date): boolean {
    return this.props.start > instant;
  }

  hasEndedBy(instant: Date): boolean {
    return this.props.end <= instant;
  }

  /** Horas entre `instant` y el comienzo. Negativo si ya empezó. */
  hoursOfNoticeFrom(instant: Date): number {
    return (this.props.start.getTime() - instant.getTime()) / 3_600_000;
  }

  movedTo(newStart: Date): TimeSlot {
    return TimeSlot.fromDuration(newStart, this.durationMinutes);
  }
}
