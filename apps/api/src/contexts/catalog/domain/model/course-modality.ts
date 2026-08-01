/** Cómo se imparte un curso. Un solo concepto de `catalog`: vive aquí. */
export const CourseModality = {
  Private: "private", // 1 a 1
  Group: "group", // 3-5 alumnos, el estándar del sector
  Intensive: "intensive", // formato sprint
  ExamPrep: "exam_prep", // DELE, Cambridge, Goethe
  Business: "business",
  Conversation: "conversation",
} as const;

export type CourseModality = (typeof CourseModality)[keyof typeof CourseModality];
