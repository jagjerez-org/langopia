import { describe, expect, it } from "vitest";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { SrsCard } from "./srs-card.aggregate.js";
import { ExerciseId, SrsCardId } from "./identifiers.js";

const AHORA = new Date("2026-07-27T10:00:00Z");
const ESCUELA = SchoolId.of("11111111-1111-4111-8111-111111111111");
const EJERCICIO = ExerciseId.of("22222222-2222-4222-8222-222222222222");
const ALUMNO = "33333333-3333-4333-8333-333333333333";
const ID = SrsCardId.of("44444444-4444-4444-8444-444444444444");

/** Tarjeta recién nacida, sin ningún repaso todavía: facilidad 2,5, intervalo 1, sin fallos. */
function tarjetaEnBlanco(dueOn = "2026-07-27") {
  return SrsCard.rehydrate({
    id: ID,
    schoolId: ESCUELA,
    studentProfileId: ALUMNO,
    exerciseId: EJERCICIO,
    ease: 2.5,
    intervalDays: 1,
    repetitions: 0,
    lapses: 0,
    dueOn,
    lastReviewedAt: null,
  });
}

describe("SrsCard (SM-2)", () => {
  it("create() nace de un fallo: repeticiones en 0, un lapso registrado, intervalo de un día", () => {
    const card = SrsCard.create({
      id: ID,
      schoolId: ESCUELA,
      studentProfileId: ALUMNO,
      exerciseId: EJERCICIO,
      quality: 1,
      today: "2026-07-27",
      now: AHORA,
    });

    expect(card.repetitions).toBe(0);
    expect(card.lapses).toBe(1);
    expect(card.intervalDays).toBe(1);
    expect(card.dueOn).toBe("2026-07-28");
    expect(card.ease).toBeCloseTo(1.96, 5); // 2.5 + (0.1 - 4*(0.08+4*0.02)) = 2.5 - 0.54
    expect(card.lastReviewedAt).toEqual(AHORA);
  });

  it("un acierto alarga el intervalo, y cada acierto seguido lo alarga más que el anterior", () => {
    const card = tarjetaEnBlanco("2026-07-27");

    card.review({ quality: 5, today: "2026-07-27", now: AHORA });
    expect(card.repetitions).toBe(1);
    expect(card.intervalDays).toBe(1); // primera repetición: SM-2 fija 1 día
    expect(card.dueOn).toBe("2026-07-28");

    card.review({ quality: 5, today: "2026-07-28", now: AHORA });
    expect(card.repetitions).toBe(2);
    expect(card.intervalDays).toBe(6); // segunda repetición: SM-2 fija 6 días
    expect(card.dueOn).toBe("2026-08-03");

    const intervaloPrevio = card.intervalDays;
    card.review({ quality: 5, today: "2026-08-03", now: AHORA });
    expect(card.repetitions).toBe(3);
    // A partir de la tercera: intervalo = intervalo anterior × facilidad (la de ANTES de este repaso).
    expect(card.intervalDays).toBeGreaterThan(intervaloPrevio);
    expect(card.intervalDays).toBe(16); // round(6 * 2.7)
  });

  it("un fallo reinicia repeticiones e intervalo a uno, y suma un lapso, sin importar lo avanzada que estuviera la tarjeta", () => {
    const card = tarjetaEnBlanco("2026-07-27");
    card.review({ quality: 5, today: "2026-07-27", now: AHORA });
    card.review({ quality: 5, today: "2026-07-28", now: AHORA });
    card.review({ quality: 5, today: "2026-08-03", now: AHORA });
    expect(card.repetitions).toBe(3);
    expect(card.lapses).toBe(0);

    card.review({ quality: 1, today: "2026-08-19", now: AHORA });

    expect(card.repetitions).toBe(0);
    expect(card.lapses).toBe(1);
    expect(card.intervalDays).toBe(1);
    expect(card.dueOn).toBe("2026-08-20");
  });

  it("la facilidad no baja de 1.3 aunque encadene muchos fallos seguidos", () => {
    const card = tarjetaEnBlanco("2026-07-27");

    for (let i = 0; i < 8; i++) {
      card.review({ quality: 0, today: "2026-07-27", now: AHORA });
    }

    expect(card.ease).toBe(1.3);
  });

  it("la facilidad tampoco baja de 1.3 con un solo fallo catastrófico desde el suelo", () => {
    const card = SrsCard.rehydrate({
      id: ID,
      schoolId: ESCUELA,
      studentProfileId: ALUMNO,
      exerciseId: EJERCICIO,
      ease: 1.3,
      intervalDays: 1,
      repetitions: 2,
      lapses: 0,
      dueOn: "2026-07-27",
      lastReviewedAt: null,
    });

    card.review({ quality: 0, today: "2026-07-27", now: AHORA });

    expect(card.ease).toBe(1.3);
  });

  it("rechaza una calificación fuera de 0-5", () => {
    const card = tarjetaEnBlanco();
    expect(() => card.review({ quality: 6, today: "2026-07-27", now: AHORA })).toThrow(
      /entre 0 y 5/,
    );
    expect(() => card.review({ quality: -1, today: "2026-07-27", now: AHORA })).toThrow(
      /entre 0 y 5/,
    );
  });

  it("rechaza una calificación no entera", () => {
    const card = tarjetaEnBlanco();
    expect(() => card.review({ quality: 2.5, today: "2026-07-27", now: AHORA })).toThrow(
      /entre 0 y 5/,
    );
  });
});
