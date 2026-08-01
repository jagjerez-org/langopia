/**
 * Datos de referencia: los planes de la plataforma y las plantillas de rúbrica
 * y ejercicio que reutilizan los tres escenarios.
 *
 * Los precios de plan se sitúan deliberadamente entre Teachworks
 * (16-89 $/mes) y Classe365 (desde 50 $/mes, ~1 $/alumno/mes), que son la
 * referencia real del mercado en julio de 2026.
 */
import type { Db } from "../index.js";
import { plans } from "../schema/index.js";
import { euros } from "./helpers.js";

export type PlanSeed = {
  code: string;
  name: string;
  priceCents: number;
  maxActiveStudents: number | null;
  includedAiCredits: number;
  defaultApplicationFeeBps: number;
  features: Record<string, boolean>;
  sortOrder: number;
};

export const PLAN_SEEDS: PlanSeed[] = [
  {
    code: "starter",
    name: "Inicial",
    priceCents: euros(49),
    maxActiveStudents: 50,
    includedAiCredits: 0,
    defaultApplicationFeeBps: 0,
    features: {
      scheduling: true,
      livekit: true,
      externalVideo: true,
      billing: true,
      connect: true,
      aiContent: false,
      assessments: false,
      transcription: false,
      mcp: false,
      siteBuilder: false,
      customDomain: false,
    },
    sortOrder: 1,
  },
  {
    code: "growth",
    name: "Crecimiento",
    priceCents: euros(149),
    maxActiveStudents: 250,
    includedAiCredits: 500,
    defaultApplicationFeeBps: 200, // 2 %
    features: {
      scheduling: true,
      livekit: true,
      externalVideo: true,
      billing: true,
      connect: true,
      aiContent: true,
      assessments: true,
      transcription: false,
      mcp: false,
      siteBuilder: false,
      customDomain: false,
    },
    sortOrder: 2,
  },
  {
    code: "scale",
    name: "Escala",
    priceCents: euros(349),
    maxActiveStudents: null,
    includedAiCredits: 2000,
    defaultApplicationFeeBps: 100, // 1 %
    features: {
      scheduling: true,
      livekit: true,
      externalVideo: true,
      billing: true,
      connect: true,
      aiContent: true,
      assessments: true,
      transcription: true,
      mcp: true,
      siteBuilder: true,
      customDomain: true,
    },
    sortOrder: 3,
  },
];

export async function seedPlans(db: Db) {
  const rows = await db
    .insert(plans)
    .values(
      PLAN_SEEDS.map((p) => ({
        code: p.code,
        name: p.name,
        priceCents: p.priceCents,
        currency: "EUR",
        interval: "month" as const,
        maxActiveStudents: p.maxActiveStudents,
        includedAiCredits: p.includedAiCredits,
        defaultApplicationFeeBps: p.defaultApplicationFeeBps,
        features: p.features,
        providerRef: `price_seed_${p.code}`,
        isActive: true,
        sortOrder: p.sortOrder,
      })),
    )
    .returning();

  const byCode = new Map(rows.map((r) => [r.code, r]));
  return byCode;
}

/* ─── Rúbricas ─────────────────────────────────────────────────────────── */

/**
 * Rúbrica de producción escrita alineada con los descriptores del MCER.
 * Es la que firma el profesor cuando valida una corrección de la IA.
 */
export const WRITING_RUBRIC = {
  code: "mcer-escrita",
  name: "Producción escrita (MCER)",
  maxScore: 20,
  criteria: [
    {
      key: "adecuacion",
      label: "Adecuación a la tarea",
      weight: 0.25,
      descriptors: [
        "No responde a lo pedido",
        "Responde parcialmente",
        "Cumple la tarea con alguna omisión",
        "Cumple la tarea por completo y con registro adecuado",
      ],
    },
    {
      key: "coherencia",
      label: "Coherencia y cohesión",
      weight: 0.25,
      descriptors: [
        "Ideas inconexas",
        "Conectores básicos y repetitivos",
        "Discurso organizado con conectores variados",
        "Texto fluido, con progresión temática clara",
      ],
    },
    {
      key: "lexico",
      label: "Riqueza léxica",
      weight: 0.25,
      descriptors: [
        "Vocabulario insuficiente para la tarea",
        "Vocabulario básico, con repeticiones",
        "Vocabulario suficiente y variado",
        "Vocabulario preciso, con expresiones idiomáticas",
      ],
    },
    {
      key: "correccion",
      label: "Corrección gramatical",
      weight: 0.25,
      descriptors: [
        "Errores que impiden la comprensión",
        "Errores frecuentes en estructuras básicas",
        "Errores ocasionales que no impiden la comprensión",
        "Uso correcto y controlado de las estructuras",
      ],
    },
  ],
};

export const SPEAKING_RUBRIC = {
  code: "mcer-oral",
  name: "Producción oral (MCER)",
  maxScore: 20,
  criteria: [
    {
      key: "fluidez",
      label: "Fluidez",
      weight: 0.3,
      descriptors: [
        "Pausas constantes que rompen la comunicación",
        "Habla entrecortada pero comprensible",
        "Ritmo natural con pausas ocasionales",
        "Habla con soltura y sin esfuerzo aparente",
      ],
    },
    {
      key: "pronunciacion",
      label: "Pronunciación",
      weight: 0.25,
      descriptors: [
        "Difícil de entender",
        "Comprensible con esfuerzo del interlocutor",
        "Clara, con acento perceptible",
        "Clara y con entonación natural",
      ],
    },
    {
      key: "interaccion",
      label: "Interacción",
      weight: 0.25,
      descriptors: [
        "No responde a lo que dice el interlocutor",
        "Responde pero no toma la iniciativa",
        "Participa y pide aclaraciones cuando hace falta",
        "Gestiona el turno de palabra con naturalidad",
      ],
    },
    {
      key: "rango",
      label: "Rango de recursos",
      weight: 0.2,
      descriptors: [
        "Recursos muy limitados",
        "Estructuras memorizadas",
        "Variedad suficiente para el nivel",
        "Amplio repertorio, adaptado al contexto",
      ],
    },
  ],
};

/* ─── Plantillas de ejercicio ──────────────────────────────────────────────
 *
 * Contenido real, no relleno. Cada tipo de la enumeración `exercise_type`
 * aparece al menos una vez para que la interfaz pueda probarlos todos.
 */

export type ExerciseSeed = {
  type:
    | "cloze"
    | "multiple_choice"
    | "matching"
    | "ordering"
    | "minimal_pairs"
    | "dictation"
    | "shadowing"
    | "listening_comprehension"
    | "reading_comprehension"
    | "written_production"
    | "spoken_production";
  skill:
    | "listening"
    | "reading"
    | "speaking"
    | "writing"
    | "vocabulary"
    | "grammar"
    | "phonetics";
  prompt: Record<string, unknown>;
  solution?: Record<string, unknown>;
  maxScore: number;
  srsEnabled: boolean;
  requiresTeacherValidation: boolean;
  rubric?: "escrita" | "oral";
  instructions: Record<string, string>;
};

/** Unidad B1 de español: «En la consulta del médico». */
export const ES_B1_DOCTOR_EXERCISES: ExerciseSeed[] = [
  {
    type: "listening_comprehension",
    skill: "listening",
    prompt: {
      audioRef: "unit-audio",
      question: "¿Desde cuándo tiene fiebre el paciente?",
      options: ["Desde ayer", "Desde hace tres días", "Desde la semana pasada"],
      playbackRate: 0.92,
    },
    solution: { correct: 1 },
    maxScore: 1,
    srsEnabled: false,
    requiresTeacherValidation: false,
    instructions: {
      "es-ES": "Escucha la conversación y responde a la pregunta.",
      "en-GB": "Listen to the conversation and answer the question.",
    },
  },
  {
    type: "cloze",
    skill: "grammar",
    prompt: {
      text: "Me duele la garganta {{1}} hace tres días y no puedo {{2}} bien.",
      blanks: [
        { id: 1, hint: "preposición temporal" },
        { id: 2, hint: "verbo, infinitivo" },
      ],
      // Sin opciones: el hueco abierto obliga a recuperar, no a descartar.
      openEnded: true,
    },
    solution: { 1: ["desde"], 2: ["tragar"] },
    maxScore: 2,
    srsEnabled: true,
    requiresTeacherValidation: false,
    instructions: {
      "es-ES": "Completa los huecos. Escribe la palabra que falta.",
      "en-GB": "Fill in the gaps. Write the missing word.",
    },
  },
  {
    type: "written_production",
    skill: "writing",
    prompt: {
      task: "Escribe un correo a tu médico de cabecera pidiendo cita.",
      minWords: 80,
      maxWords: 100,
      register: "formal",
      mustInclude: ["saludo formal", "motivo de la consulta", "disponibilidad horaria"],
    },
    maxScore: 20,
    srsEnabled: false,
    requiresTeacherValidation: true,
    rubric: "escrita",
    instructions: {
      "es-ES": "Escribe entre 80 y 100 palabras. Cuida el registro formal.",
      "en-GB": "Write 80-100 words. Mind the formal register.",
    },
  },
  {
    type: "minimal_pairs",
    skill: "phonetics",
    prompt: {
      pairs: [
        { a: "pero", b: "perro", contrast: "vibrante simple vs. múltiple" },
        { a: "caro", b: "carro", contrast: "vibrante simple vs. múltiple" },
        { a: "coro", b: "corro", contrast: "vibrante simple vs. múltiple" },
      ],
      question: "¿Qué palabra oyes?",
    },
    solution: { sequence: ["b", "a", "b"] },
    maxScore: 3,
    srsEnabled: true,
    requiresTeacherValidation: false,
    instructions: {
      "es-ES": "Escucha y marca la palabra que oyes.",
      "en-GB": "Listen and mark the word you hear.",
    },
  },
  {
    type: "matching",
    skill: "vocabulary",
    prompt: {
      left: ["la receta", "el mostrador", "la sala de espera", "el justificante"],
      right: [
        "documento para el trabajo",
        "papel con el medicamento",
        "donde se pide cita",
        "donde esperas tu turno",
      ],
    },
    solution: { pairs: [[0, 1], [1, 2], [2, 3], [3, 0]] },
    maxScore: 4,
    srsEnabled: true,
    requiresTeacherValidation: false,
    instructions: {
      "es-ES": "Relaciona cada palabra con su definición.",
      "en-GB": "Match each word with its definition.",
    },
  },
  {
    type: "spoken_production",
    skill: "speaking",
    prompt: {
      task: "Explica a la recepcionista qué te pasa y pide cita para esta semana.",
      durationSeconds: 90,
      prompts: ["síntomas", "desde cuándo", "preferencia de horario"],
    },
    maxScore: 20,
    srsEnabled: false,
    requiresTeacherValidation: true,
    rubric: "oral",
    instructions: {
      "es-ES": "Grábate hablando durante 90 segundos.",
      "en-GB": "Record yourself speaking for 90 seconds.",
    },
  },
];

/** Unidad A2 de alemán: «Im Supermarkt». */
export const DE_A2_SUPERMARKT_EXERCISES: ExerciseSeed[] = [
  {
    type: "dictation",
    skill: "listening",
    prompt: {
      audioRef: "unit-audio",
      segments: 4,
      question: "Schreib, was du hörst.",
    },
    solution: {
      segments: [
        "Ich hätte gern ein Kilo Äpfel.",
        "Wo finde ich die Milch?",
        "Das macht zusammen zwölf Euro.",
        "Brauchen Sie eine Tüte?",
      ],
    },
    maxScore: 4,
    srsEnabled: true,
    requiresTeacherValidation: false,
    instructions: {
      "de-DE": "Hör zu und schreib die Sätze auf.",
      "es-ES": "Escucha y escribe las frases.",
    },
  },
  {
    type: "multiple_choice",
    skill: "grammar",
    prompt: {
      question: "Ich gehe ___ Supermarkt.",
      options: ["in den", "in dem", "im", "zu der"],
    },
    solution: { correct: 0 },
    maxScore: 1,
    srsEnabled: true,
    requiresTeacherValidation: false,
    instructions: {
      "de-DE": "Wähl die richtige Antwort.",
      "es-ES": "Elige la respuesta correcta.",
    },
  },
  {
    type: "ordering",
    skill: "grammar",
    prompt: {
      tokens: ["heute", "ich", "einkaufen", "gehe", "Nachmittag", "am"],
      target: "Wortstellung im Aussagesatz",
    },
    solution: { order: [1, 3, 0, 5, 4, 2] },
    maxScore: 1,
    srsEnabled: false,
    requiresTeacherValidation: false,
    instructions: {
      "de-DE": "Bring die Wörter in die richtige Reihenfolge.",
      "es-ES": "Ordena las palabras.",
    },
  },
  {
    type: "shadowing",
    skill: "speaking",
    prompt: {
      audioRef: "unit-audio",
      target: "Entschuldigung, wo finde ich die Milchprodukte?",
      maxDelayMs: 800,
    },
    maxScore: 5,
    srsEnabled: false,
    requiresTeacherValidation: false,
    instructions: {
      "de-DE": "Sprich gleichzeitig mit der Aufnahme.",
      "es-ES": "Repite a la vez que el audio.",
    },
  },
];

/** Unidad B2 de inglés de negocios: «Negotiating a deadline». */
export const EN_B2_BUSINESS_EXERCISES: ExerciseSeed[] = [
  {
    type: "reading_comprehension",
    skill: "reading",
    prompt: {
      passage:
        "Following our call on Tuesday, I am writing to confirm that the delivery date has been moved to 14 September. We appreciate that this is later than originally agreed, and we are happy to absorb the additional storage costs.",
      question: "What is the sender offering to compensate for the delay?",
      options: [
        "A discount on the next order",
        "To cover the extra storage costs",
        "An earlier partial delivery",
      ],
    },
    solution: { correct: 1 },
    maxScore: 1,
    srsEnabled: false,
    requiresTeacherValidation: false,
    instructions: {
      "en-GB": "Read the email and answer the question.",
      "pt-BR": "Leia o e-mail e responda à pergunta.",
    },
  },
  {
    type: "cloze",
    skill: "vocabulary",
    prompt: {
      text: "We would like to {{1}} the deadline by two weeks and {{2}} the revised schedule by Friday.",
      blanks: [
        { id: 1, hint: "verb, formal register" },
        { id: 2, hint: "verb, to send for approval" },
      ],
      openEnded: true,
    },
    solution: { 1: ["extend", "push back"], 2: ["submit", "circulate"] },
    maxScore: 2,
    srsEnabled: true,
    requiresTeacherValidation: false,
    instructions: {
      "en-GB": "Complete the sentence with an appropriate verb.",
      "pt-BR": "Complete a frase com o verbo adequado.",
    },
  },
  {
    type: "written_production",
    skill: "writing",
    prompt: {
      task: "Reply to the client rejecting the new deadline but proposing an alternative.",
      minWords: 120,
      maxWords: 150,
      register: "formal",
      mustInclude: ["acknowledgement", "clear refusal", "concrete alternative"],
    },
    maxScore: 20,
    srsEnabled: false,
    requiresTeacherValidation: true,
    rubric: "escrita",
    instructions: {
      "en-GB": "Write 120-150 words in a professional register.",
      "pt-BR": "Escreva de 120 a 150 palavras em registro profissional.",
    },
  },
];
