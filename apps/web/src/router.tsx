import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { LoginScreen } from "./features/auth/LoginScreen.js";
import { ProtectedLayout } from "./features/auth/ProtectedLayout.js";
import { AnalyticsScreen } from "./features/analytics/AnalyticsScreen.js";
import { InvoiceDetailScreen } from "./features/billing/InvoiceDetailScreen.js";
import { InvoicesListScreen } from "./features/billing/InvoicesListScreen.js";
import { StripeConnectionScreen } from "./features/billing/StripeConnectionScreen.js";
import { CalendarScreen } from "./features/calendar/CalendarScreen.js";
import { ClassroomScreen } from "./features/classroom/ClassroomScreen.js";
import { ContentUnitsListScreen } from "./features/content/ContentUnitsListScreen.js";
import { GenerateUnitScreen } from "./features/content/GenerateUnitScreen.js";
import { LeadsFunnelScreen } from "./features/leads/LeadsFunnelScreen.js";
import { UploadMaterialScreen } from "./features/content/upload/UploadMaterialScreen.js";
import { ReviewUnitScreen } from "./features/content/ReviewUnitScreen.js";
import { CoursesScreen } from "./features/courses/CoursesScreen.js";
import { GroupDetailScreen } from "./features/courses/GroupDetailScreen.js";
import { DashboardScreen } from "./features/dashboard/DashboardScreen.js";
import { CorrectionsInboxScreen } from "./features/exercises/CorrectionsInboxScreen.js";
import { DailyReviewScreen } from "./features/exercises/DailyReviewScreen.js";
import { ExercisesToDoScreen } from "./features/exercises/ExercisesToDoScreen.js";
import { CreateExamScreen } from "./features/exams/CreateExamScreen.js";
import { GradeExamScreen } from "./features/exams/GradeExamScreen.js";
import { TakeExamScreen } from "./features/exams/TakeExamScreen.js";
import { RegisterScreen } from "./features/onboarding/RegisterScreen.js";
import { WelcomeScreen } from "./features/onboarding/WelcomeScreen.js";
import { PortalAttendanceScreen } from "./features/portal/PortalAttendanceScreen.js";
import { PortalInvoicesScreen } from "./features/portal/PortalInvoicesScreen.js";
import { PortalProgressScreen } from "./features/portal/PortalProgressScreen.js";
import { PortalSessionsScreen } from "./features/portal/PortalSessionsScreen.js";
import { StudentCreateScreen } from "./features/students/StudentCreateScreen.js";
import { StudentDetailScreen } from "./features/students/StudentDetailScreen.js";
import { StudentImportScreen } from "./features/students/StudentImportScreen.js";
import { StudentsListScreen } from "./features/students/StudentsListScreen.js";
import { TeacherDetailScreen } from "./features/teachers/TeacherDetailScreen.js";
import { TeachersListScreen } from "./features/teachers/TeachersListScreen.js";
import { TranscriptsScreen } from "./features/transcripts/TranscriptsScreen.js";
import { SiteDomainsScreen } from "./features/sites/SiteDomainsScreen.js";
import { SiteEditorScreen } from "./features/sites/SiteEditorScreen.js";

function RootLayout(): ReactElement {
  return <Outlet />;
}

export const rootRoute = createRootRoute({ component: RootLayout });

/** `/entrar` (Tarea 3, verbatim del brief): la pantalla de acceso. Pública. */
export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/entrar",
  component: LoginScreen,
});

/**
 * `/registro` (Tarea 12, verbatim del brief): registro de escuela. Fuera de
 * `protectedRoute`, como `/entrar` — es la única pantalla del panel que usa
 * alguien sin sesión ni escuela todavía.
 */
export const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/registro",
  component: RegisterScreen,
});

/**
 * Ruta pasillo, sin `path` propio: todo lo que cuelga de aquí pasa por
 * `ProtectedLayout` (sesión + tenant resueltos, o el selector, o la
 * redirección a `/entrar`) antes de pintarse.
 */
export const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "protected",
  component: ProtectedLayout,
});

/** `/` (Tarea 6, verbatim del brief): el panel de dirección. */
export const homeRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/",
  component: DashboardScreen,
});

export const analyticsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/analitica",
  component: AnalyticsScreen,
});

export const transcriptsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/transcripciones",
  component: TranscriptsScreen,
});

export const siteDomainsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/web/dominios",
  component: SiteDomainsScreen,
});

export const leadsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/candidatos",
  component: LeadsFunnelScreen,
});

export const siteEditorRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/web/editor",
  component: SiteEditorScreen,
});

/**
 * `/bienvenida` (Tarea 12, verbatim del brief): asistente de puesta en
 * marcha, justo tras registrar la escuela. Dentro de `protectedRoute`: ya
 * hay sesión, tenant y membresía `owner` en ese momento.
 */
export const welcomeRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/bienvenida",
  component: WelcomeScreen,
});

/**
 * Alumnado (Tarea 7, verbatim del brief): `/alumnos`, `/alumnos/nuevo`,
 * `/alumnos/:id` y `/alumnos/importar`. Las rutas estáticas (`nuevo`,
 * `importar`) antes que la dinámica (`$studentId`) para que quede claro cuál
 * gana si algún día coincidieran; TanStack Router ya prioriza los segmentos
 * estáticos sobre los dinámicos igualmente.
 */
export const studentsListRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/alumnos",
  component: StudentsListScreen,
});

export const studentCreateRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/alumnos/nuevo",
  component: StudentCreateScreen,
});

export const studentImportRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/alumnos/importar",
  component: StudentImportScreen,
});

export const studentDetailRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/alumnos/$studentId",
  component: StudentDetailScreen,
});

/** `/calendario` (Tarea 9, verbatim del brief): el calendario semanal. */
export const calendarRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/calendario",
  component: CalendarScreen,
});

/**
 * Profesorado, cursos y grupos (Tarea 8, verbatim del brief): `/profesores`,
 * `/profesores/:id`, `/cursos` y `/grupos/:id`. Sin `/cursos/:id` ni
 * `/profesores/nuevo`/`/grupos/nuevo`: el brief no los lista entre las
 * interfaces que produce esta tarea — alta de curso y de grupo son diálogos
 * dentro de `/cursos`, y la ficha de un curso vive ahí mismo, con sus grupos
 * anidados.
 */
export const teachersListRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/profesores",
  component: TeachersListScreen,
});

export const teacherDetailRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/profesores/$teacherId",
  component: TeacherDetailScreen,
});

export const coursesRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/cursos",
  component: CoursesScreen,
});

export const groupDetailRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/grupos/$groupId",
  component: GroupDetailScreen,
});

/**
 * Portal del alumno (Tarea 11, verbatim del brief): `/mi/clases`,
 * `/mi/facturas` y `/mi/asistencia`. `student`/`guardian`, nunca dirección ni
 * profesorado — el rol lo comprueba la API en cada endpoint
 * (`StudentPortalController`, `@Roles("student", "guardian")`); estas rutas
 * no repiten esa comprobación en el cliente.
 */
export const portalSessionsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/mi/clases",
  component: PortalSessionsScreen,
});

export const portalInvoicesRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/mi/facturas",
  component: PortalInvoicesScreen,
});

export const portalAttendanceRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/mi/asistencia",
  component: PortalAttendanceScreen,
});

/**
 * `/mi/progreso` (Tarea 16 de la ola 2, verbatim del brief: «pestaña de
 * progreso... en su portal»): mismo rol que las tres rutas de arriba.
 */
export const portalProgressRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/mi/progreso",
  component: PortalProgressScreen,
});

/**
 * Aula (Tarea 11, verbatim del brief): `/aula/:sessionId`. Cualquier
 * membresía de la escuela puede pedir el token de una clase (`ClassroomController`,
 * `@Roles("owner", "admin", "teacher", "student", "guardian")`); QUÉ clase es
 * suya lo decide `JoinClassroomSessionHandler` con la matrícula, no esta ruta.
 */
export const classroomRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/aula/$sessionId",
  component: ClassroomScreen,
});

/**
 * Facturación (Tarea 10, verbatim del brief): `/facturacion`,
 * `/facturacion/:id` y `/ajustes/cobros`. La ruta estática (`/facturacion`)
 * antes que la dinámica (`$invoiceId`), igual que `/alumnos`.
 */
export const invoicesListRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/facturacion",
  component: InvoicesListScreen,
});

export const invoiceDetailRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/facturacion/$invoiceId",
  component: InvoiceDetailScreen,
});

export const stripeConnectionRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/ajustes/cobros",
  component: StripeConnectionScreen,
});

/**
 * Exámenes (Tarea 15 de la ola 2): `/examenes/nuevo` (generar),
 * `/examenes/:id` (hacerlo con cronómetro) y `/examenes/:id/corregir`
 * (corregir y firmar). La estática (`nuevo`) antes que la dinámica
 * (`$examId`), igual que `/alumnos`.
 */
export const createExamRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/examenes/nuevo",
  component: CreateExamScreen,
});

export const takeExamRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/examenes/$examId",
  component: TakeExamScreen,
});

export const gradeExamRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/examenes/$examId/corregir",
  component: GradeExamScreen,
});

/**
 * Generador de contenido (Tarea 11 de la ola 2): `/contenido` (listado),
 * `/contenido/nuevo` (formulario de generación) y `/contenido/:id` (revisión
 * y publicación). La estática (`nuevo`) antes que la dinámica
 * (`$contentUnitId`), igual que `/alumnos` y `/examenes`.
 */
export const contentUnitsListRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/contenido",
  component: ContentUnitsListScreen,
});

export const generateUnitRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/contenido/nuevo",
  component: GenerateUnitScreen,
});

/**
 * `/contenido/subir` (Tarea 14 de la ola 2): subida de material propio.
 * Estática, así que va antes que `$contentUnitId` por el mismo motivo que
 * `/contenido/nuevo`.
 */
export const uploadMaterialRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/contenido/subir",
  component: UploadMaterialScreen,
});

export const reviewUnitRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/contenido/$contentUnitId",
  component: ReviewUnitScreen,
});

/**
 * Hacer ejercicios (Tarea 12 de la ola 2): `/mi/ejercicios` y `/mi/repaso`
 * para el alumnado y su tutela —bajo `/mi`, igual que el resto del portal—, y
 * `/correcciones` para el profesorado y dirección. El rol lo comprueba la API
 * en cada endpoint (`AttemptsController`, `ExercisesController`); estas rutas
 * no repiten esa comprobación en el cliente.
 */
export const myExercisesRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/mi/ejercicios",
  component: ExercisesToDoScreen,
});

export const myReviewRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/mi/repaso",
  component: DailyReviewScreen,
});

export const correctionsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/correcciones",
  component: CorrectionsInboxScreen,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  registerRoute,
  protectedRoute.addChildren([
    homeRoute,
    analyticsRoute,
    transcriptsRoute,
    siteDomainsRoute,
    leadsRoute,
    siteEditorRoute,
    welcomeRoute,
    studentsListRoute,
    studentCreateRoute,
    studentImportRoute,
    studentDetailRoute,
    calendarRoute,
    teachersListRoute,
    teacherDetailRoute,
    coursesRoute,
    groupDetailRoute,
    portalSessionsRoute,
    portalInvoicesRoute,
    portalAttendanceRoute,
    portalProgressRoute,
    classroomRoute,
    invoicesListRoute,
    invoiceDetailRoute,
    stripeConnectionRoute,
    createExamRoute,
    takeExamRoute,
    gradeExamRoute,
    contentUnitsListRoute,
    generateUnitRoute,
    uploadMaterialRoute,
    reviewUnitRoute,
    myExercisesRoute,
    myReviewRoute,
    correctionsRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
