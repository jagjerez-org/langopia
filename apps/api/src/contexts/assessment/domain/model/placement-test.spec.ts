import { describe, expect, it } from "vitest";
import { CefrLevel } from "../../../shared/domain/model/cefr-level.js";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { PlacementTest } from "./placement-test.aggregate.js";
import { PlacementTestId } from "./identifiers.js";

const AHORA = new Date("2026-07-27T10:00:00Z");
const ESCUELA = SchoolId.of("11111111-1111-4111-8111-111111111111");
const ALUMNO = "22222222-2222-4222-8222-222222222222";
const DESTREZAS = ["grammar", "vocabulary", "reading", "listening"];

function nuevaPrueba(skills: readonly string[] = DESTREZAS): PlacementTest {
  return PlacementTest.start({
    id: PlacementTestId.of("33333333-3333-4333-8333-333333333333"),
    schoolId: ESCUELA,
    studentProfileId: ALUMNO,
    language: "es",
    skills,
    now: AHORA,
  });
}

/**
 * Alimenta la prueba con una secuencia de aciertos/fallos, un ítem distinto
 * cada vez. `skill`, si no se da, rota entre las destrezas de la prueba —
 * igual que haría la aplicación real siguiendo `nextItemCriteria()`.
 */
function responder(test: PlacementTest, patron: readonly boolean[], skill?: string): void {
  for (let i = 0; i < patron.length; i++) {
    // Una vez terminada, no se envían más respuestas: distintas pruebas
    // pasan de sobra (p. ej. "acierta todo") para comprobar dónde para el
    // algoritmo por sí solo, sin necesidad de calcular el número exacto de
    // preguntas de antemano.
    if (test.finished) break;
    const criteria = test.nextItemCriteria();
    test.answer({
      itemId: `item-${i}`,
      skill: skill ?? criteria?.skill ?? DESTREZAS[0]!,
      level: criteria?.level ?? test.currentLevel,
      correct: patron[i]!,
      now: AHORA,
    });
  }
}

describe("PlacementTest", () => {
  it("empieza en B1 y sin ninguna pregunta respondida", () => {
    const test = nuevaPrueba();
    expect(test.currentLevel).toBe(CefrLevel.B1);
    expect(test.questionsAsked).toBe(0);
    expect(test.finished).toBe(false);
    expect(test.result).toBeNull();
    expect(test.pullDomainEvents()[0]!.eventName).toBe("assessment.placement_test.started");
  });

  it("no se puede abrir sin ninguna destreza: el banco estaría vacío", () => {
    expect(() => nuevaPrueba([])).toThrow(/nivelación/i);
  });

  describe("sube de nivel", () => {
    it("tres aciertos seguidos suben un nivel, y no antes", () => {
      const test = nuevaPrueba();
      responder(test, [true, true]);
      expect(test.currentLevel).toBe(CefrLevel.B1);

      responder(test, [true]);
      expect(test.currentLevel).toBe(CefrLevel.B2);
    });

    it("no sube más allá de C2", () => {
      const test = nuevaPrueba();
      // B1 -> B2 -> C1 -> C2: tres tandas de tres aciertos.
      responder(test, [true, true, true, true, true, true, true, true, true]);
      expect(test.currentLevel).toBe(CefrLevel.C2);
    });
  });

  describe("baja de nivel", () => {
    it("dos fallos seguidos bajan un nivel, y no con uno solo", () => {
      const test = nuevaPrueba();
      responder(test, [false]);
      expect(test.currentLevel).toBe(CefrLevel.B1);

      responder(test, [false]);
      expect(test.currentLevel).toBe(CefrLevel.A2);
    });

    it("no baja más allá de A1", () => {
      const test = nuevaPrueba();
      // B1 -> A2 -> A1: dos tandas de dos fallos.
      responder(test, [false, false, false, false]);
      expect(test.currentLevel).toBe(CefrLevel.A1);
    });
  });

  it("se estabiliza (y termina) tras seis preguntas seguidas sin cambiar de nivel", () => {
    const test = nuevaPrueba();
    // Alternar acierto/fallo no completa nunca una racha de subida o bajada:
    // el nivel se queda quieto desde la primera pregunta.
    responder(test, [true, false, true, false, true]);
    expect(test.finished).toBe(false);

    responder(test, [false]);
    expect(test.finished).toBe(true);
    expect(test.questionsAsked).toBe(6);
    expect(test.result).toEqual({
      level: CefrLevel.B1,
      skillLevels: expect.any(Object),
      questionsAsked: 6,
    });
  });

  it("corta a las 30 preguntas si nunca llega a estabilizarse ni se queda en un extremo", () => {
    const test = nuevaPrueba();
    // Tres aciertos (sube) + dos fallos (baja), en bucle: nunca hay seis
    // preguntas seguidas sin cambio, y nunca se sale de B1/B2.
    const ciclo = [true, true, true, false, false];
    const patron = [...ciclo, ...ciclo, ...ciclo, ...ciclo, ...ciclo, ...ciclo];
    expect(patron).toHaveLength(30);

    responder(test, patron);

    expect(test.finished).toBe(true);
    expect(test.questionsAsked).toBe(30);
  });

  it("no admite más respuestas una vez terminada", () => {
    const test = nuevaPrueba();
    responder(test, [true, false, true, false, true, false]);
    expect(test.finished).toBe(true);

    expect(() =>
      test.answer({ itemId: "extra", skill: "grammar", level: test.currentLevel, correct: true, now: AHORA }),
    ).toThrow(/ya ha terminado/i);
  });

  it("nextItemCriteria() rota las destrezas por turno y es null tras terminar", () => {
    const test = nuevaPrueba(["reading", "listening"]);
    expect(test.nextItemCriteria()).toMatchObject({ skill: "reading", level: CefrLevel.B1 });

    responder(test, [true]);
    expect(test.nextItemCriteria()).toMatchObject({ skill: "listening" });

    responder(test, [false, true, false, true, false]);
    expect(test.finished).toBe(true);
    expect(test.nextItemCriteria()).toBeNull();
  });

  describe("desglose por destreza", () => {
    it("una destreza puede subir mientras otra baja, aunque el nivel global no cambie", () => {
      const test = nuevaPrueba(["reading", "speaking"]);

      // reading acierta siempre, speaking falla siempre: el patrón global
      // (T,F,T,F,T,F) nunca completa una racha, así que el nivel GLOBAL se
      // queda en B1 y la prueba termina a las seis preguntas por
      // estabilidad — pero cada destreza vivió su propia racha en paralelo.
      responder(test, [true, false, true, false, true, false]);

      expect(test.finished).toBe(true);
      expect(test.currentLevel).toBe(CefrLevel.B1);
      expect(test.result!.skillLevels).toEqual({
        reading: CefrLevel.B2, // tres aciertos seguidos (en sus propias tres preguntas)
        speaking: CefrLevel.A2, // dos fallos seguidos (en sus dos primeras preguntas)
      });
    });

    it("una destreza nunca preguntada no aparece en el desglose", () => {
      const test = nuevaPrueba(["reading", "listening", "speaking"]);
      // Rotación reading -> listening -> speaking -> reading -> ...
      // Alternar para estabilizarse a las seis preguntas sin tocar "speaking"
      // más que una vez no es trivial con tres destrezas rotando, así que se
      // fuerza la parada con `finish()` a mitad de rotación.
      responder(test, [true, true]); // reading, listening
      test.finish(AHORA);

      expect(test.finished).toBe(true);
      expect(Object.keys(test.result!.skillLevels)).toEqual(["reading", "listening"]);
    });
  });

  describe("alumnos simulados en los extremos", () => {
    it("un alumno que acierta todo sube hasta C2 y se detiene por estabilidad, no por el tope", () => {
      const test = nuevaPrueba();
      responder(test, Array(20).fill(true));

      expect(test.finished).toBe(true);
      expect(test.currentLevel).toBe(CefrLevel.C2);
      expect(test.result!.level).toBe(CefrLevel.C2);
      expect(test.questionsAsked).toBe(15);
      expect(test.questionsAsked).toBeLessThan(30);
    });

    it("un alumno que falla todo baja hasta A1 y se detiene por estabilidad, no por el tope", () => {
      const test = nuevaPrueba();
      responder(test, Array(20).fill(false));

      expect(test.finished).toBe(true);
      expect(test.currentLevel).toBe(CefrLevel.A1);
      expect(test.result!.level).toBe(CefrLevel.A1);
      expect(test.questionsAsked).toBe(10);
      expect(test.questionsAsked).toBeLessThan(30);
    });

    it("un alumno que responde al azar siempre converge, como muy tarde a las 30", () => {
      // PRNG determinista (mulberry32) para que la prueba sea reproducible
      // sin depender de Math.random().
      let seed = 42;
      const azar = () => {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };

      const test = nuevaPrueba();
      let salvaguarda = 0;
      while (!test.finished && salvaguarda < 30) {
        const criteria = test.nextItemCriteria()!;
        test.answer({
          itemId: `azar-${salvaguarda}`,
          skill: criteria.skill,
          level: criteria.level,
          correct: azar() < 0.5,
          now: AHORA,
        });
        salvaguarda++;
      }

      expect(test.finished).toBe(true);
      expect(test.questionsAsked).toBeLessThanOrEqual(30);
      expect(Object.values(CefrLevel)).toContain(test.result!.level);
      expect(Object.keys(test.result!.skillLevels).length).toBeGreaterThan(0);
    });
  });

  describe("snapshot / rehydrate", () => {
    it("un viaje de ida y vuelta por el snapshot no cambia el comportamiento", () => {
      const patron = [true, false, true, false, true, false]; // se estabiliza a las 6

      const sinInterrupcion = nuevaPrueba();
      responder(sinInterrupcion, patron);

      // Misma prueba, pero "reiniciando" el proceso a mitad de camino: se
      // serializa tras la pregunta 3 y se reconstruye antes de seguir, tal
      // como haría la capa HTTP entre `start` y cada `answer` (ver cabecera
      // de la clase: no hay fila de base de datos que recargar).
      const conInterrupcion = nuevaPrueba();
      responder(conInterrupcion, patron.slice(0, 3));
      const reconstruida = PlacementTest.rehydrate(conInterrupcion.toSnapshot());
      responder(reconstruida, patron.slice(3));

      expect(reconstruida.finished).toBe(true);
      expect(reconstruida.questionsAsked).toBe(sinInterrupcion.questionsAsked);
      expect(reconstruida.result).toEqual(sinInterrupcion.result);
    });

    it("rehydrate() no emite eventos: ya ocurrió", () => {
      const original = nuevaPrueba();
      const reconstruida = PlacementTest.rehydrate(original.toSnapshot());
      expect(reconstruida.pullDomainEvents()).toEqual([]);
    });
  });

  it("finish() emite el evento con el resultado, y es idempotente", () => {
    const test = nuevaPrueba();
    responder(test, [true, false, true, false, true, false]);

    const eventos = test.pullDomainEvents();
    const terminado = eventos.find((e) => e.eventName === "assessment.placement_test.finished");
    expect(terminado).toBeDefined();
    expect(terminado!.payload()).toMatchObject({ level: CefrLevel.B1, questionsAsked: 6 });

    const resultadoPrevio = test.result;
    test.finish(AHORA);
    expect(test.result).toEqual(resultadoPrevio);
  });
});
