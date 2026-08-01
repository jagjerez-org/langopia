import { z } from "zod";

/**
 * Esquema de la respuesta esperada de `generateUnit`. Es el sobre de salida
 * estructurada (lo que fuerza el proveedor), no el esquema de negocio de la
 * unidad: `ContentUnit` (tarea 1) no impone más forma que «tres cadenas no
 * vacías» sobre `title`/`description`/`body`, así que no hay invariante
 * cruzada adicional que comprobar aquí (a diferencia de los ejercicios).
 */
export const unitGenerationOutputSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  body: z.string().min(1),
});

export type UnitGenerationOutput = z.infer<typeof unitGenerationOutputSchema>;

/**
 * Prompt de generación del cuerpo de una unidad didáctica.
 *
 * El `body` se genera en el idioma que se enseña (`language`): es contenido
 * para practicar ese idioma, no un texto sobre él. `title` y `description`
 * son metadatos de catálogo —lo que ve el profesorado al elegir la unidad,
 * no lo que practica el alumnado— y por eso van en `locale`, el idioma de la
 * escuela: es la misma frontera que marca la ola 2 para las instrucciones de
 * los ejercicios («los ejercicios se generan en el idioma que se enseña;
 * solo las instrucciones se traducen a los idiomas de la escuela»).
 */
export function buildUnitGenerationPrompt(params: {
  language: string;
  level: string;
  topic: string;
  skills: string[];
  locale: string;
  sourceMaterial?: string;
}): { system: string; user: string } {
  const system =
    "Eres un diseñador instruccional experto en la enseñanza de idiomas, especializado en el " +
    "Marco Común Europeo de Referencia (MCER). Escribes contenido didáctico auténtico y " +
    "pedagógicamente coherente con el nivel pedido. Respondes siempre con el JSON exacto que se " +
    "te pide, sin texto antes ni después.";

  const skillsList = params.skills.length > 0 ? params.skills.join(", ") : "comprensión y expresión general";
  const sourceNote = params.sourceMaterial
    ? `\n\nMaterial de partida aportado por el profesorado (parte de él, no lo ignores):\n"""\n${params.sourceMaterial}\n"""`
    : "";

  const user =
    `Genera una unidad didáctica de idioma «${params.language}», nivel MCER ${params.level}, sobre ` +
    `el tema «${params.topic}», que practique estas destrezas: ${skillsList}.\n\n` +
    `Devuelve un JSON con:\n` +
    `- "body": el cuerpo de la unidad (texto, diálogo o material de lectura), escrito ENTERAMENTE ` +
    `en «${params.language}» — nunca en otro idioma, ni siquiera para aclarar algo.\n` +
    `- "title" y "description": un título y una descripción breve de la unidad para el catálogo ` +
    `del profesorado, en el idioma de la escuela («${params.locale}»).` +
    sourceNote;

  return { system, user };
}
