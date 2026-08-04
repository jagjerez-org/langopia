import type { CrudField } from "../molecules/CrudForm/CrudForm.js";
import type {
  Professor,
  ProfessorAction,
  ProfessorsPageLabels,
  ProfessorStatus,
} from "../organisms/ProfessorsPage/ProfessorsPage.js";
import type {
  Student,
  StudentAction,
  StudentPageLabels,
  StudentStatus,
} from "../organisms/StudentPage/StudentPage.js";

/**
 * Datos ficticios de personas (estudiantes y profesorado) para stories y
 * specs de los organismos de gestión. Sin API: los importa quien monta la
 * página y los callbacks son espías o no-ops.
 */

// --- Estudiantes ---

export const studentStatusLabels: Record<StudentStatus, string> = {
  active: "Activo",
  inactive: "De baja",
};

export const students: Student[] = [
  {
    id: "stu-01",
    name: "Ana Torres",
    email: "ana.torres@example.com",
    group: "Inglés B1 — Mañanas",
    status: "active",
  },
  {
    id: "stu-02",
    name: "Luis Martín",
    email: "luis.martin@example.com",
    group: "Conversación C1 — Tardes",
    status: "active",
  },
  {
    id: "stu-03",
    name: "Carmen Ruiz",
    email: "carmen.ruiz@example.com",
    group: "Inglés A2 — Intensivo",
    status: "inactive",
  },
  {
    id: "stu-04",
    name: "Diego Sanz",
    email: "diego.sanz@example.com",
    group: "Inglés B1 — Mañanas",
    status: "active",
  },
  {
    id: "stu-05",
    name: "Elena Gil",
    email: "elena.gil@example.com",
    group: "Preparación Cambridge",
    status: "active",
  },
  {
    id: "stu-06",
    name: "Jorge Prieto",
    email: "jorge.prieto@example.com",
    group: "Inglés B2 — Tardes",
    status: "inactive",
  },
  {
    id: "stu-07",
    name: "Marta Vidal",
    email: "marta.vidal@example.com",
    group: "Conversación C1 — Tardes",
    status: "active",
  },
];

export const studentActions: StudentAction[] = [
  { id: "view", label: "Ver ficha" },
  { id: "edit", label: "Editar" },
  { id: "unenroll", label: "Dar de baja" },
];

export const studentCreateFields: CrudField[] = [
  { name: "name", label: "Nombre y apellidos", required: true },
  { name: "email", label: "Correo electrónico", type: "email", required: true },
  { name: "group", label: "Curso o grupo" },
];

export const studentPageLabels: StudentPageLabels = {
  title: "Estudiantes",
  listTitle: "Listado de estudiantes",
  listLabel: "Estudiantes",
  searchLabel: "Buscar estudiante",
  searchPlaceholder: "Nombre o correo…",
  sortLabel: "Ordenar por",
  sortByNameLabel: "Nombre",
  sortByEmailLabel: "Correo electrónico",
  filterLabel: "Estado",
  allStatusesLabel: "Todos los estados",
  statusLabels: studentStatusLabels,
  emptyLabel: "No hay estudiantes con estos criterios.",
  previousLabel: "Anterior",
  nextLabel: "Siguiente",
  addStudentLabel: "Añadir estudiante",
  addStudentTitle: "Nuevo estudiante",
  submitStudentLabel: "Guardar estudiante",
  cancelLabel: "Cancelar",
  detailLabel: "Ficha del estudiante",
  detailGroupLabel: "Grupo",
  detailStatusLabel: "Estado",
  closeDetailLabel: "Cerrar ficha",
};

// --- Profesorado ---

export const professorStatusLabels: Record<ProfessorStatus, string> = {
  active: "Activo",
  inactive: "De baja",
};

export const professors: Professor[] = [
  {
    id: "pro-01",
    name: "Ana García",
    email: "ana.garcia@example.com",
    specialty: "Inglés",
    status: "active",
  },
  {
    id: "pro-02",
    name: "Marc Vidal",
    email: "marc.vidal@example.com",
    specialty: "Conversación",
    status: "active",
  },
  {
    id: "pro-03",
    name: "Laura Serra",
    email: "laura.serra@example.com",
    specialty: "Francés",
    status: "active",
  },
  {
    id: "pro-04",
    name: "Pau Ferrer",
    email: "pau.ferrer@example.com",
    specialty: "Alemán",
    status: "inactive",
  },
  {
    id: "pro-05",
    name: "Núria Bosch",
    email: "nuria.bosch@example.com",
    specialty: "Preparación de exámenes",
    status: "active",
  },
];

export const professorActions: ProfessorAction[] = [
  { id: "view", label: "Ver ficha" },
  { id: "edit", label: "Editar" },
  { id: "deactivate", label: "Dar de baja" },
];

export const professorCreateFields: CrudField[] = [
  { name: "name", label: "Nombre y apellidos", required: true },
  { name: "email", label: "Correo electrónico", type: "email", required: true },
  { name: "specialty", label: "Especialidad", required: true },
];

export const professorsPageLabels: ProfessorsPageLabels = {
  title: "Profesorado",
  listTitle: "Listado de profesorado",
  listLabel: "Profesorado",
  searchLabel: "Buscar profesor",
  searchPlaceholder: "Nombre o especialidad…",
  sortLabel: "Ordenar por",
  sortByNameLabel: "Nombre",
  sortBySpecialtyLabel: "Especialidad",
  filterLabel: "Estado",
  allStatusesLabel: "Todos los estados",
  statusLabels: professorStatusLabels,
  emptyLabel: "No hay profesorado con estos criterios.",
  previousLabel: "Anterior",
  nextLabel: "Siguiente",
  addProfessorLabel: "Añadir profesor",
  addProfessorTitle: "Nuevo profesor",
  submitProfessorLabel: "Guardar profesor",
  cancelLabel: "Cancelar",
};
