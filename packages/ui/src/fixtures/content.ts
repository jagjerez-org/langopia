import type {
  ElearningCourse,
  ElearningLessonAction,
  ElearningPageLabels,
} from "../organisms/ElearningPage/ElearningPage.js";
import type {
  MediaFile,
  MediaFileAction,
  MediaLibraryPageLabels,
  MediaType,
} from "../organisms/MediaLibraryPage/MediaLibraryPage.js";

/**
 * Datos ficticios de contenido (cursos e-learning y biblioteca de medios)
 * para stories y specs de los organismos de contenido. Sin API: los importa
 * quien monta la página y los callbacks son espías o no-ops.
 */

// --- Cursos e-learning ---

export const elearningCourses: ElearningCourse[] = [
  {
    id: "cou-01",
    title: "Gramática inglesa B1",
    category: "Gramática",
    image: {
      src: "https://picsum.photos/seed/langopia-course-grammar/640/360",
      alt: "Cuaderno con apuntes de gramática",
    },
    progress: 60,
    lessons: [
      { id: "les-01", title: "Present perfect", duration: "12 min", completed: true },
      { id: "les-02", title: "Past simple vs. present perfect", duration: "15 min", completed: true },
      { id: "les-03", title: "Futuros: will y going to", duration: "14 min", completed: false },
      { id: "les-04", title: "Condicionales", duration: "18 min", completed: false },
    ],
  },
  {
    id: "cou-02",
    title: "Conversación: viajes",
    category: "Conversación",
    image: {
      src: "https://picsum.photos/seed/langopia-course-travel/640/360",
      alt: "Maleta y mapa sobre una mesa",
    },
    progress: 25,
    lessons: [
      { id: "les-05", title: "En el aeropuerto", duration: "10 min", completed: true },
      { id: "les-06", title: "En el hotel", duration: "11 min", completed: false },
      { id: "les-07", title: "Pedir en un restaurante", duration: "13 min", completed: false },
    ],
  },
  {
    id: "cou-03",
    title: "Preparación Cambridge B2",
    category: "Exámenes",
    image: {
      src: "https://picsum.photos/seed/langopia-course-exam/640/360",
      alt: "Examen con lápiz y goma",
    },
    progress: 80,
    lessons: [
      { id: "les-08", title: "Reading: use of English", duration: "20 min", completed: true },
      { id: "les-09", title: "Writing: el essay", duration: "22 min", completed: true },
      { id: "les-10", title: "Speaking: simulacro", duration: "25 min", completed: false },
    ],
  },
  {
    id: "cou-04",
    title: "Vocabulario esencial A2",
    category: "Vocabulario",
    image: {
      src: "https://picsum.photos/seed/langopia-course-vocab/640/360",
      alt: "Tarjetas de vocabulario de colores",
    },
    lessons: [
      { id: "les-11", title: "La familia", duration: "8 min", completed: false },
      { id: "les-12", title: "La comida", duration: "9 min", completed: false },
    ],
  },
];

export const elearningLessonActions: ElearningLessonAction[] = [
  { id: "open", label: "Abrir lección" },
  { id: "toggle", label: "Marcar completada" },
];

export const elearningPageLabels: ElearningPageLabels = {
  title: "E-learning",
  catalogLabel: "Catálogo de cursos",
  searchLabel: "Buscar curso",
  searchPlaceholder: "Título del curso…",
  categoryFilterLabel: "Categoría",
  allCategoriesLabel: "Todas las categorías",
  emptyLabel: "No hay cursos con estos criterios.",
  progressLabel: (progress) => `${progress} % completado`,
  backLabel: "Volver al catálogo",
  lessonsListLabel: (courseTitle) => `Lecciones de ${courseTitle}`,
  completedLabel: "Completada",
  pendingLabel: "Pendiente",
  lessonActionsLabel: (lessonTitle) => `Acciones de ${lessonTitle}`,
};

// --- Biblioteca de medios ---

export const mediaTypeLabels: Record<MediaType, string> = {
  image: "Imagen",
  video: "Vídeo",
  audio: "Audio",
  document: "Documento",
};

export const mediaFiles: MediaFile[] = [
  {
    id: "med-01",
    name: "portada-curso-b1.png",
    type: "image",
    previewUrl: "https://picsum.photos/seed/langopia-media-cover/640/360",
    size: "480 KB",
  },
  {
    id: "med-02",
    name: "presentacion-nivel-a2.jpg",
    type: "image",
    previewUrl: "https://picsum.photos/seed/langopia-media-intro/640/360",
    size: "720 KB",
  },
  {
    id: "med-03",
    name: "leccion-fonetica.mp4",
    type: "video",
    size: "24 MB",
  },
  {
    id: "med-04",
    name: "listening-episodio-3.mp3",
    type: "audio",
    size: "6 MB",
  },
  {
    id: "med-05",
    name: "guia-gramatica-b1.pdf",
    type: "document",
    size: "1,2 MB",
  },
  {
    id: "med-06",
    name: "calendario-2026.pdf",
    type: "document",
    size: "340 KB",
  },
];

export const mediaFileActions: MediaFileAction[] = [
  { id: "download", label: "Descargar" },
  { id: "rename", label: "Renombrar" },
  { id: "delete", label: "Eliminar" },
];

export const mediaLibraryPageLabels: MediaLibraryPageLabels = {
  title: "Biblioteca de medios",
  libraryLabel: "Archivos de la biblioteca",
  searchLabel: "Buscar archivo",
  searchPlaceholder: "Nombre del archivo…",
  typeFilterLabel: "Tipo",
  allTypesLabel: "Todos los tipos",
  typeLabels: mediaTypeLabels,
  emptyLabel: "No hay archivos con estos criterios.",
  uploadLabel: "Subir archivo",
};
