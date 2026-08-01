/**
 * ¿La fecha de nacimiento indica minoría de edad?
 *
 * Es la regla de negocio hecha interfaz, no una copia de la regla: solo
 * decide qué campos MOSTRAR en el formulario de alta (Tarea 7, brief,
 * verbatim: "el formulario que muestra los campos de tutor legal en cuanto
 * la fecha de nacimiento indica que es menor"). Quien decide de verdad si el
 * alta es válida sin tutor es el dominio (`DateOfBirth.isMinorAt`,
 * `EnrolStudentHandler`, `guardian_required`); si este cálculo y el del
 * servidor llegaran a discrepar en un caso límite (el mismo día del
 * cumpleaños, cambios de huso horario), el servidor manda: rechaza o acepta
 * igual, y `guardian_required` fuerza a mostrar la sección de tutor aunque
 * este cálculo hubiera dicho que no hacía falta (ver `StudentCreateScreen`).
 */
const MAJORITY_AGE = 18;

export function isMinorOn(dateOfBirth: string, now: Date): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  if (!match) return false;

  const [, y, m, d] = match;
  const birth = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (Number.isNaN(birth.getTime()) || birth > now) return false;

  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birth.getUTCDate())) age--;

  return age < MAJORITY_AGE;
}
