import type { CrudField } from "../molecules/CrudForm/CrudForm.js";
import type { KpiChartProps } from "../molecules/KpiChart/KpiChart.js";
import type { ListItem } from "../molecules/List/List.js";
import type {
  KpiPageLabels,
  KpiRangeOption,
} from "../organisms/KpiPage/KpiPage.js";
import type {
  PaymentAction,
  PaymentRecord,
  PaymentsPageLabels,
  PaymentStatus,
} from "../organisms/PaymentsPage/PaymentsPage.js";
import type {
  PlanningPageLabels,
  PlanningSession,
  PlanningSessionAction,
  PlanningSessionStatus,
} from "../organisms/PlanningPage/PlanningPage.js";
import type {
  PermissionCategory,
  RoleDefinition,
  RolesPermissionsPageLabels,
} from "../organisms/RolesPermissionsPage/RolesPermissionsPage.js";

/**
 * Datos ficticios para stories y specs de los organismos de gestión del panel
 * (roles y permisos, métricas, pagos y planificación). Sin API: los importa
 * quien monta la página y los callbacks son espías o no-ops.
 */

// --- Roles y permisos ---

export const managementPermissionCatalog: PermissionCategory[] = [
  {
    id: "students",
    label: "Alumnado",
    permissions: [
      { key: "students.view", label: "Ver alumnado" },
      { key: "students.edit", label: "Editar alumnado" },
      { key: "students.enroll", label: "Gestionar matrículas" },
    ],
  },
  {
    id: "billing",
    label: "Facturación",
    permissions: [
      { key: "billing.view", label: "Ver facturas" },
      { key: "billing.create", label: "Emitir facturas" },
      { key: "billing.refund", label: "Reembolsar pagos" },
    ],
  },
  {
    id: "planning",
    label: "Planificación",
    permissions: [
      { key: "planning.view", label: "Ver planificación" },
      { key: "planning.edit", label: "Editar sesiones" },
    ],
  },
];

export const managementRoles: RoleDefinition[] = [
  {
    id: "role-admin",
    name: "Administración",
    description: "Acceso completo al panel",
    enabledPermissions: managementPermissionCatalog.flatMap((category) =>
      category.permissions.map((permission) => permission.key),
    ),
  },
  {
    id: "role-teacher",
    name: "Profesorado",
    description: "Gestiona sus clases y su alumnado",
    enabledPermissions: ["students.view", "planning.view", "planning.edit"],
  },
  {
    id: "role-frontdesk",
    name: "Recepción",
    description: "Atención a familias y cobros",
    enabledPermissions: [
      "students.view",
      "students.enroll",
      "billing.view",
      "billing.create",
      "planning.view",
    ],
  },
];

export const rolesPermissionsLabels: RolesPermissionsPageLabels = {
  title: "Roles y permisos",
  rolesListLabel: "Roles",
  permissionsTitle: "Permisos",
  emptySelectionLabel: "Selecciona un rol para ver sus permisos.",
  createRoleLabel: "Nuevo rol",
  createRoleTitle: "Crear rol",
  roleNameLabel: "Nombre del rol",
  roleDescriptionLabel: "Descripción",
  submitRoleLabel: "Guardar rol",
  cancelLabel: "Cancelar",
  deleteRoleLabel: "Eliminar rol",
  roleActionsLabel: (roleName) => `Acciones de ${roleName}`,
};

// --- Métricas (KPIs) ---

export const managementKpis: KpiChartProps[] = [
  {
    title: "Alumnado activo",
    value: "342",
    delta: "+4,1 %",
    trend: "up",
    trendLabel: "sube un 4,1 %",
    data: [298, 305, 312, 308, 321, 330, 336, 342],
    chartLabel: "Evolución del alumnado activo, tendencia ascendente",
  },
  {
    title: "Ingresos del mes",
    value: "18.640 €",
    delta: "+12,3 %",
    trend: "up",
    trendLabel: "sube un 12,3 %",
    data: [13200, 14100, 13800, 15200, 16100, 15900, 17400, 18640],
    chartLabel: "Evolución de los ingresos mensuales, tendencia ascendente",
  },
  {
    title: "Ocupación media",
    value: "87 %",
    delta: "-2,0 %",
    trend: "down",
    trendLabel: "baja un 2,0 %",
    data: [92, 91, 93, 90, 89, 90, 88, 87],
    chartLabel: "Evolución de la ocupación media, tendencia descendente",
  },
  {
    title: "Bajas del mes",
    value: "6",
    delta: "-25,0 %",
    trend: "down",
    trendLabel: "baja un 25,0 %",
    data: [9, 11, 8, 10, 8, 7, 8, 6],
    chartLabel: "Evolución de las bajas mensuales, tendencia descendente",
  },
];

export const kpiRangeOptions: KpiRangeOption[] = [
  { value: "7", label: "Últimos 7 días" },
  { value: "30", label: "Últimos 30 días" },
  { value: "90", label: "Últimos 90 días" },
];

export const kpiPageLabels: KpiPageLabels = {
  title: "Métricas",
  rangeSelectorLabel: "Periodo",
  detailTitle: "Detalle por curso",
  detailListLabel: "Detalle de métricas por curso",
};

export const kpiDetailItems: ListItem[] = [
  {
    id: "course-b1",
    title: "Inglés B1 — Mañanas",
    subtitle: "24 alumnos · 92 % de ocupación",
    tags: [{ label: "Activo", variant: "success" }],
  },
  {
    id: "course-c1",
    title: "Conversación C1 — Tardes",
    subtitle: "11 alumnos · 73 % de ocupación",
    tags: [{ label: "Activo", variant: "success" }],
  },
  {
    id: "course-a2",
    title: "Inglés A2 — Intensivo",
    subtitle: "8 alumnos · 53 % de ocupación",
    tags: [{ label: "Riesgo", variant: "warning" }],
  },
];

// --- Pagos y facturas ---

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  paid: "Pagado",
  pending: "Pendiente",
  overdue: "Vencido",
};

export const paymentSummaryKpis: KpiChartProps[] = [
  {
    title: "Cobrado este mes",
    value: "12.480 €",
    delta: "+8,2 %",
    trend: "up",
    trendLabel: "sube un 8,2 %",
    data: [8200, 9100, 8900, 9800, 10400, 10100, 11600, 12480],
    chartLabel: "Evolución de lo cobrado en el mes, tendencia ascendente",
  },
  {
    title: "Pendiente de cobro",
    value: "1.240 €",
    delta: "-15,4 %",
    trend: "down",
    trendLabel: "baja un 15,4 %",
    data: [2100, 1980, 2050, 1870, 1690, 1520, 1380, 1240],
    chartLabel: "Evolución de lo pendiente de cobro, tendencia descendente",
  },
];

export const managementPayments: PaymentRecord[] = [
  {
    id: "pay-001",
    concept: "Factura 2026-041 — Curso B1",
    detail: "Ana Torres",
    amount: "120,00 €",
    status: "paid",
  },
  {
    id: "pay-002",
    concept: "Factura 2026-042 — Curso C1",
    detail: "Luis Martín",
    amount: "140,00 €",
    status: "pending",
  },
  {
    id: "pay-003",
    concept: "Factura 2026-038 — Material del curso",
    detail: "Carmen Ruiz",
    amount: "30,00 €",
    status: "overdue",
  },
  {
    id: "pay-004",
    concept: "Factura 2026-043 — Matrícula",
    detail: "Diego Sanz",
    amount: "25,00 €",
    status: "paid",
  },
  {
    id: "pay-005",
    concept: "Factura 2026-044 — Curso A2",
    detail: "Elena Gil",
    amount: "110,00 €",
    status: "pending",
  },
  {
    id: "pay-006",
    concept: "Factura 2026-036 — Curso B2",
    detail: "Jorge Prieto",
    amount: "130,00 €",
    status: "overdue",
  },
  {
    id: "pay-007",
    concept: "Factura 2026-045 — Conversación",
    detail: "Marta Vidal",
    amount: "60,00 €",
    status: "paid",
  },
];

export const paymentActions: PaymentAction[] = [
  { id: "view", label: "Ver factura" },
  { id: "download", label: "Descargar PDF" },
  { id: "refund", label: "Reembolsar" },
];

export const paymentsPageLabels: PaymentsPageLabels = {
  title: "Pagos y facturas",
  listTitle: "Facturas",
  listLabel: "Listado de facturas",
  filterLabel: "Estado",
  allStatusesLabel: "Todos los estados",
  statusLabels: paymentStatusLabels,
  emptyLabel: "No hay pagos con este estado.",
  previousLabel: "Anterior",
  nextLabel: "Siguiente",
};

// --- Planificación ---

const today = new Date();

/** Día civil de hoy desplazado `offset` días (misma convención que calendar.ts). */
function dayAt(offset: number): Date {
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
}

export const planningStatusLabels: Record<PlanningSessionStatus, string> = {
  scheduled: "Programada",
  completed: "Realizada",
  cancelled: "Cancelada",
};

/** Sesiones repartidas alrededor de "hoy" para que las historias siempre tengan datos. */
export const planningSessions: PlanningSession[] = [
  {
    id: "ses-01",
    date: dayAt(0),
    time: "09:00",
    title: "Inglés B1 — Grupo A",
    teacher: "Ana García",
    status: "scheduled",
  },
  {
    id: "ses-02",
    date: dayAt(0),
    time: "11:30",
    title: "Conversación C1",
    teacher: "Marc Vidal",
    status: "scheduled",
  },
  {
    id: "ses-03",
    date: dayAt(1),
    time: "17:00",
    title: "Inglés A2 — Grupo B",
    teacher: "Laura Serra",
    status: "scheduled",
  },
  {
    id: "ses-04",
    date: dayAt(-1),
    time: "10:00",
    title: "Preparación Cambridge",
    teacher: "Ana García",
    status: "completed",
  },
  {
    id: "ses-05",
    date: dayAt(2),
    time: "19:00",
    title: "Workshop de pronunciación",
    teacher: "Marc Vidal",
    status: "cancelled",
  },
  {
    id: "ses-06",
    date: dayAt(4),
    time: "18:30",
    title: "Inglés B2 — Grupo C",
    teacher: "Laura Serra",
    status: "scheduled",
  },
];

export const planningSessionActions: PlanningSessionAction[] = [
  { id: "edit", label: "Editar sesión" },
  { id: "cancel", label: "Cancelar sesión" },
];

export const planningCreateFields: CrudField[] = [
  { name: "title", label: "Título de la sesión", required: true },
  { name: "date", label: "Fecha", type: "date", required: true },
  { name: "time", label: "Hora" },
  { name: "teacher", label: "Profesorado" },
];

export const planningPageLabels: PlanningPageLabels = {
  title: "Planificación",
  dayDetailListLabel: "Sesiones del día",
  emptyDayLabel: "No hay sesiones este día.",
  createEventLabel: "Nueva sesión",
  createEventTitle: "Crear sesión",
  submitEventLabel: "Guardar sesión",
  cancelLabel: "Cancelar",
  statusLabels: planningStatusLabels,
  sessionActionsLabel: (sessionTitle) => `Acciones de ${sessionTitle}`,
};
