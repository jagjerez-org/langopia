import type {
  SiteBuilderBlock,
  SiteBuilderBlockDefinition,
  SiteBuilderLabels,
} from "../organisms/SiteBuilder/SiteBuilder.js";
import type {
  ExerciseBuilderLabels,
  ExerciseDefinition,
  ExerciseTypeOption,
} from "../organisms/ExerciseBuilder/ExerciseBuilder.js";

/**
 * Datos ficticios neutros para stories y specs de `SiteBuilder` y
 * `ExerciseBuilder`. Sin datos del dominio de Langopia real: contenido de
 * relleno para una escuela genérica.
 */

export const siteBuilderLabels: SiteBuilderLabels = {
  catalogTitle: "Bloques disponibles",
  canvasTitle: "Lienzo",
  canvasEmptyLabel: "Añade bloques del catálogo para montar la página.",
  blockActionsLabel: "Acciones de",
  moveUpLabel: "Subir",
  moveDownLabel: "Bajar",
  removeLabel: "Eliminar",
  selectedBlockTitle: "Bloque seleccionado",
  blockNameLabel: "Nombre del bloque",
  saveLabel: "Guardar",
  previewLabel: "Previsualizar",
  publishLabel: "Publicar",
};

export const siteBuilderAvailableBlocks: SiteBuilderBlockDefinition[] = [
  {
    type: "hero",
    label: "Portada",
    description: "Cabecera con título, subtítulo e imagen",
    defaultProps: { título: "", subtítulo: "" },
  },
  {
    type: "text",
    label: "Texto",
    description: "Párrafo de contenido libre",
    defaultProps: { contenido: "" },
  },
  {
    type: "gallery",
    label: "Galería",
    description: "Rejilla de fotografías",
  },
  {
    type: "contact",
    label: "Contacto",
    description: "Dirección, teléfono y formulario",
    defaultProps: { dirección: "", teléfono: "" },
  },
];

export const siteBuilderInitialBlocks: SiteBuilderBlock[] = [
  {
    id: "hero-1",
    type: "hero",
    label: "Portada principal",
    props: { título: "Academia Norte", subtítulo: "Clases para todas las edades" },
  },
  {
    id: "text-1",
    type: "text",
    label: "Presentación",
    props: { contenido: "Texto de bienvenida de la escuela." },
  },
];

export const exerciseBuilderLabels: ExerciseBuilderLabels = {
  definitionTitle: "Definición del ejercicio",
  titleLabel: "Título",
  statementLabel: "Enunciado",
  typeLabel: "Tipo de ejercicio",
  questionsTitle: "Preguntas",
  questionsEmptyLabel: "Todavía no hay preguntas.",
  addQuestionLabel: "Añadir pregunta",
  questionActionsLabel: "Acciones de",
  editLabel: "Editar",
  removeLabel: "Eliminar",
  questionPromptLabel: "Pregunta",
  questionAnswerLabel: "Respuesta",
  saveQuestionLabel: "Guardar pregunta",
  cancelEditLabel: "Cancelar",
  previewTitle: "Vista del alumno",
  saveLabel: "Guardar ejercicio",
};

export const exerciseTypeOptions: ExerciseTypeOption[] = [
  { value: "multiple_choice", label: "Opción múltiple" },
  { value: "short_answer", label: "Respuesta corta" },
  { value: "matching", label: "Emparejar" },
];

export const exerciseInitial: ExerciseDefinition = {
  title: "Vocabulario de la casa",
  statement: "Repasa las palabras de la unidad 3.",
  type: "multiple_choice",
  questions: [
    { id: "q-1", prompt: "¿Qué palabra significa «cocina»?", answer: "Kitchen" },
    { id: "q-2", prompt: "Escribe la traducción de «ventana».", answer: "Window" },
  ],
};
