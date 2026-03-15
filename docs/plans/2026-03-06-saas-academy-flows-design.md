# SaaS Academy Management - Flows & Implementation Plan

**Date:** 2026-03-06
**Status:** Approved

---

## 1. Flow Diagrams

### 1.1 Onboarding - Registro de Academia

```mermaid
flowchart TD
    A[Usuario llega a Langopia] --> B[Registro cuenta]
    B --> C{Email + Password / Google OAuth}
    C --> D[Crear Academia]
    D --> D1[Nombre + Logo opcional]
    D1 --> D2{Tipo de cuenta}
    D2 -->|Freelance| D3[Auto-asigna owner como teacher]
    D2 -->|Academia| D4[Multi-teacher mode]
    D3 --> E[Configurar Idiomas]
    D4 --> E
    E --> F[Configurar Niveles]
    F --> F1[Sugerencia CEFR: A1-C2]
    F1 --> F2{Acepta estandar?}
    F2 -->|Si| G[Crear Planes de Estudiante]
    F2 -->|No| F3[Personalizar niveles]
    F3 --> G

    G --> G1[Plan: nombre, precio, periodicidad]
    G1 --> G2[Limites por tipo de clase]
    G2 --> G3[Limites: clases individuales x periodo]
    G3 --> G4[Limites: clases grupales x periodo]
    G4 --> G5[Limites: cancelaciones, reservas]
    G5 --> G6[Accesos: learning path, chat IA]
    G6 --> G7{Agregar otro plan?}
    G7 -->|Si| G1
    G7 -->|No| H[Seleccionar Plan Langopia]

    H --> H1{Plan elegido}
    H1 -->|Free| H2[Sin pago - continuar]
    H1 -->|Starter/Pro| H3[Stripe Checkout]
    H1 -->|Enterprise| H4[Contacto ventas]
    H3 --> I[Stripe Connect Onboarding]
    H2 --> I
    I --> I1[Configurar cuenta conectada]
    I1 --> I2[Verificacion identidad/banco]
    I2 --> I3{Verificacion completa?}
    I3 -->|Si| J[Academia ACTIVA]
    I3 -->|No| I4[Academia PENDIENTE - recordatorio]
    I4 --> I3

    J --> K[Tutorial in-app primera visita]
    K --> L[Dashboard Overview]
```

### 1.2 Gestion de Contenido

```mermaid
flowchart TD
    subgraph Jerarquia["Jerarquia de Contenido"]
        LP[Learning Path] --> C[Cursos]
        C --> L[Lessons]
        L --> E[Exercises]
    end

    subgraph Filtros["Clasificacion"]
        LANG[Idioma] --> LP
        LANG --> C
        LANG --> L
        LANG --> E
        NIV[Nivel] --> LP
        NIV --> C
        NIV --> L
        NIV --> E
    end

    subgraph Media["Media Library"]
        ML[Subir recurso] --> ML1[Imagenes/PDF/Audio/Video]
        ML1 --> ML2[Asociar a idioma + nivel]
        ML2 --> ML3[Disponible en Cursos y Exercises]
    end

    subgraph ExerciseBank["Exercise Bank"]
        EB1{Crear ejercicio} -->|Manual| EB2[Formulario ejercicio]
        EB1 -->|IA| EB3[Generar con GPT]
        EB2 --> EB4[Ejercicio guardado]
        EB3 --> EB4
        EB4 --> EB5[Asociar a Lesson]
    end
```

### 1.3 Gestion de Clases

```mermaid
flowchart TD
    A[Staff crea clase] --> B{Tipo de clase}
    B -->|Individual| C[1 estudiante]
    B -->|Grupal| D[N estudiantes max segun plan]

    C --> E[Asignar datos]
    D --> E
    E --> E1[Seleccionar profesor]
    E1 --> E2[Fecha + hora + duracion]
    E2 --> E3[Seleccionar curso/lesson opcional]
    E3 --> E4[Seleccionar nivel + idioma]
    E4 --> E5[Asignar estudiante/s]

    E5 --> F{Plataforma de video}
    F -->|LiveKit| F1[Room se crea on-demand al unirse teacher]
    F -->|Zoom| F2[Pegar link de Zoom]

    F1 --> G[Clase en calendario]
    F2 --> G

    G --> G1[Enviar notificacion a estudiante/s]
    G1 --> G2[Enviar link a profesor]

    subgraph EnClase["Durante la clase LiveKit"]
        H1[Profesor entra con link] --> H2[Room se crea]
        H2 --> H3[Estudiante/s entran]
        H3 --> H4[Video + Chat + Notas + Slides]
        H4 --> H5[Profesor termina clase]
    end

    subgraph PostClase["Post-clase LiveKit"]
        P1[Detener grabacion] --> P2[Transcripcion Whisper]
        P2 --> P3[Analisis GPT-4o-mini]
        P3 --> P4[ClassReport generado]
        P4 --> P5[LearningProfile actualizado]
    end

    G --> EnClase
    EnClase --> PostClase

    subgraph Cancelar["Cancelacion"]
        X1[Staff cancela clase] --> X2[Verificar limites cancelacion estudiante]
        X2 --> X3[Notificar estudiante/profesor]
        X3 --> X4[Clase marcada cancelled]
    end
```

### 1.4 Flujo de Pagos - Stripe Connect

```mermaid
flowchart TD
    subgraph AcademiaPaga["Academia paga a Langopia"]
        A1[Academia] -->|Suscripcion mensual| A2[Stripe]
        A2 -->|Free: 0 EUR| A3[Acceso basico]
        A2 -->|Starter: 29 EUR| A4[Acceso medio]
        A2 -->|Pro: 99 EUR| A5[Acceso avanzado]
        A2 -->|Enterprise: Custom| A6[Acceso total]
    end

    subgraph EstudiantePaga["Estudiante paga a Academia"]
        B1[Estudiante] -->|Suscribe plan academia| B2[Stripe Checkout]
        B2 --> B3[Stripe Connect]
        B3 --> B4{Split del pago}
        B4 -->|98%| B5[Cuenta conectada Academia]
        B4 -->|2%| B6[Langopia application fee]
    end

    subgraph Payouts["Payouts"]
        B5 --> C1[Stripe auto-payout]
        C1 --> C2[Cuenta bancaria academia]
    end

    subgraph Revenue["Dashboard Financings"]
        D1[KPIs por periodo] --> D2[Ganancias del periodo]
        D1 --> D3[Comparacion periodo anterior]
        D1 --> D4[Suscripciones activas]
        D1 --> D5[Suscripciones inactivas]
        D1 --> D6[Suscripciones morosas]
        D7{Periodo} -->|Diario| D1
        D7 -->|Mensual default| D1
        D7 -->|Trimestral Q1-Q4| D1
        D7 -->|Anual| D1
        D8[Vista global] --> D1
        D9[Vista por plan] --> D1
    end
```

### 1.5 Registro de Estudiantes

```mermaid
flowchart TD
    subgraph DesdeStaff["Via Staff SaaS"]
        A1[Staff va a Students] --> A2[Alta manual]
        A2 --> A3[Nombre + Email + Nivel + Idioma]
        A3 --> A4[Enviar invitacion email]
        A4 --> A5[Estudiante recibe link]
        A5 --> A6[Crea cuenta + elige plan academia]
        A6 --> A7[Pago via Stripe Connect]
        A7 --> A8[Estudiante activo]
    end

    subgraph DesdeLanding["Via Landing Academia"]
        B1[Estudiante visita landing academia] --> B2[Ve planes disponibles]
        B2 --> B3[Selecciona plan]
        B3 --> B4[Registro: nombre + email + password]
        B4 --> B5[Pago via Stripe Connect]
        B5 --> B6[Estudiante activo]
    end

    subgraph Gestion["Gestion de Estudiantes"]
        C1[Lista estudiantes] --> C2{Acciones}
        C2 --> C3[Ver perfil completo]
        C3 --> C3a[Reportes IA]
        C3 --> C3b[Historial clases + profesores]
        C3 --> C3c[Sesiones login]
        C3 --> C3d[Progreso Learning Path]
        C3 --> C3e[Uso Chat IA]
        C2 --> C4[Desactivar - soft delete]
        C4 --> C5[Sigue visible en lista pero inactivo]
    end
```

### 1.6 Aplicacion de Profesores

```mermaid
flowchart TD
    A[Profesor visita landing academia] --> B[Seccion 'Trabaja con nosotros']
    B --> C[Formulario de aplicacion]

    subgraph Formulario["Formulario Estandar + Custom"]
        C --> D1[Nombre completo]
        D1 --> D2[Email + telefono]
        D2 --> D3[Idiomas que ensena]
        D3 --> D4[Experiencia docente]
        D4 --> D5[CV adjunto]
        D5 --> D6[Campos custom de la academia]
        D6 --> D7[Documentos adicionales]
    end

    D7 --> E[Aplicacion enviada]
    E --> F[Staff recibe notificacion]
    F --> G[Staff revisa en seccion Teachers]
    G --> H{Decision}
    H -->|Aprobado| I[Profesor activo en academia]
    I --> J[Puede recibir links de clases]
    H -->|Rechazado| K[Notificacion de rechazo]
```

### 1.7 Gestion de Team (Staff)

```mermaid
flowchart TD
    A[Admin va a Team] --> B{Alta de miembro}
    B -->|Por formulario| C[Rellenar datos + asignar rol]
    B -->|Por link de invitacion| D[Generar link]
    D --> E[Invitado abre link]
    E --> F[Ve formulario de registro]
    F --> C

    C --> G{Asignar rol}
    G --> G1[Admin - acceso total]
    G --> G2[Content Manager - cursos, lessons, exercises, media]
    G --> G3[Financing - suscripciones, revenue, KPIs]
    G --> G4[Coordinator - clases, estudiantes, profesores]

    G1 --> H[Plantilla de permisos aplicada]
    G2 --> H
    G3 --> H
    G4 --> H

    H --> I{Personalizar?}
    I -->|No| J[Miembro activo con permisos plantilla]
    I -->|Si| K[Ajustar permisos individuales]
    K --> J

    subgraph Permisos["Sistema de Permisos"]
        P1[Plantilla de rol] --> P2[Permisos por seccion]
        P2 --> P3[Clases: ver / crear / editar / cancelar]
        P2 --> P4[Contenido: ver / crear / editar / eliminar]
        P2 --> P5[Estudiantes: ver / crear / desactivar]
        P2 --> P6[Profesores: ver / aprobar / rechazar]
        P2 --> P7[Financings: ver KPIs / gestionar planes]
        P2 --> P8[Team: ver / invitar / editar roles]
        P2 --> P9[Integraciones: ver / crear API keys]
    end
```

### 1.8 Landing por Academia (Tenant)

```mermaid
flowchart TD
    A[Academia con plan Enterprise] --> B[Acceso a Landing builder]
    B --> C[Personalizar landing]
    C --> C1[Logo + colores + nombre]
    C1 --> C2[Descripcion academia]
    C2 --> C3[Planes visibles para estudiantes]
    C3 --> C4[Seccion profesores - formulario aplicacion]
    C4 --> C5[Landing publicada]

    C5 --> D{Visitante}
    D -->|Estudiante| E[Ver planes + registrarse + pagar]
    D -->|Profesor| F[Formulario de aplicacion]

    subgraph URL["URL Schema"]
        U1[academy-slug.langopia.com]
        U2[langopia.com/a/academy-slug]
    end
```

### 1.9 Tutorial In-App (Onboarding Guide)

```mermaid
flowchart TD
    A[Primera visita a seccion] --> B{Ya vio tutorial de esta seccion?}
    B -->|No| C[Mostrar overlay/tooltip guiado]
    C --> D[Paso 1: Que es esta seccion]
    D --> E[Paso 2: Acciones principales]
    E --> F[Paso 3: Tips]
    F --> G[Marcar tutorial como visto]
    G --> H[Usuario usa seccion normalmente]
    B -->|Si| H

    subgraph Secciones["Tutoriales por seccion"]
        T1[Overview - vision global]
        T2[Clases - calendario y creacion]
        T3[Cursos - jerarquia contenido]
        T4[Students - gestion alumnos]
        T5[Financings - revenue y planes]
        T6[Team - roles y permisos]
    end
```

---

## 2. Mapa de Navegacion SaaS

```
Dashboard
|
+-- Overview (global, todas las academias)
|
+-- [Selector de Academia]
|   |
|   +-- Clases (calendario, crear/editar/cancelar)
|   +-- Cursos (CRUD, asociar lessons, filtrar idioma/nivel)
|   +-- Lessons (CRUD, asociar exercises, filtrar idioma/nivel)
|   +-- Exercise Bank (manual + IA, filtrar idioma/nivel)
|   +-- Learning Path (ordenar cursos, asignar a niveles)
|   +-- Media Library (upload, categorizar, usar en contenido)
|   +-- Students (lista, perfil completo, soft delete, alta manual)
|   +-- Teachers (lista, perfil consulta, aplicaciones, aprobar/rechazar)
|   +-- Financings (planes academia, KPIs, revenue, periodos)
|   +-- Team (staff, roles, permisos, invitaciones)
|   +-- Integraciones (API keys)
|
+-- Settings (perfil usuario, suscripcion Langopia, Stripe Connect)
```

---

## 3. Entidades Nuevas / Modificadas

### Nuevas entidades
| Entidad | Descripcion |
|---------|-------------|
| `Course` | Agrupacion de Lessons. Pertenece a Academy. Tiene idioma + nivel |
| `CourseLeson` | Relacion Course-Lesson con orden |
| `LearningPathCourse` | Relacion LearningPath-Course con orden (reemplaza LearningPathLesson) |
| `AcademyLevel` | Niveles custom por academia (ej: A1, A1.1, B2+) |
| `AcademyLanguage` | Idiomas que ensena la academia |
| `AcademyPlan` | Planes que la academia ofrece a estudiantes (nombre, precio, periodicidad, limites) |
| `StudentSubscription` | Suscripcion de estudiante a plan de academia (Stripe sub ID, status, fechas) |
| `TeacherApplication` | Formulario de aplicacion de profesor (datos + archivos + status) |
| `ApplicationCustomField` | Campos custom del formulario por academia |
| `TeamMember` | Staff de la academia (user + rol + permisos custom) |
| `RoleTemplate` | Plantilla de permisos por rol (admin, content_manager, financing, coordinator) |
| `OnboardingProgress` | Tracking de tutoriales vistos por usuario |
| `AcademyLanding` | Config de landing por academia (colores, textos, secciones activas) |

### Entidades modificadas
| Entidad | Cambio |
|---------|--------|
| `Academy` | Agregar: `stripeConnectAccountId`, `onboardingCompleted`, relacion a languages/levels |
| `Student` | Agregar: `isActive` (soft delete), relacion a `StudentSubscription` |
| `Class` | Agregar: `zoomLink` (nullable), relacion a `Course` opcional |
| `Lesson` | Agregar: FK a `AcademyLanguage`, FK a `AcademyLevel` |
| `Exercise` | Agregar: FK a `AcademyLanguage`, FK a `AcademyLevel` |
| `User` | Ya existe - se usa para staff via `TeamMember` |

### Entidades que se eliminan/reemplazan
| Entidad | Accion |
|---------|--------|
| `AcademyMember` | Reemplazada por `TeamMember` (mas granular) |
| `LearningPathLesson` | Reemplazada por `LearningPathCourse` (ahora LP -> Course -> Lesson) |

---

## 4. Actualizacion PLAN_LIMITS (Langopia SaaS)

```typescript
export const PLAN_LIMITS = {
  free: {
    maxAcademies: 1,
    maxClassesPerMonth: 10,
    maxClassHoursPerMonth: 10,
    maxReportsPerMonth: Infinity,
    maxStudentsPerRoom: 2,
    maxStorageBytes: 5_368_709_120,        // 5 GB
    maxAiTokensPerMonth: 50_000,
    maxTtsCharactersPerMonth: 10_000,
    integrations: false,
    academyLanding: false,
  },
  starter: {
    maxAcademies: 3,
    maxClassesPerMonth: 50,
    maxClassHoursPerMonth: 25,
    maxReportsPerMonth: Infinity,
    maxStudentsPerRoom: 8,
    maxStorageBytes: 10_737_418_240,       // 10 GB
    maxAiTokensPerMonth: 500_000,
    maxTtsCharactersPerMonth: 100_000,
    integrations: false,
    academyLanding: false,
  },
  professional: {
    maxAcademies: 10,
    maxClassesPerMonth: 200,
    maxClassHoursPerMonth: 100,
    maxReportsPerMonth: Infinity,
    maxStudentsPerRoom: 25,
    maxStorageBytes: 53_687_091_200,       // 50 GB
    maxAiTokensPerMonth: 2_000_000,
    maxTtsCharactersPerMonth: 500_000,
    integrations: true,
    academyLanding: false,
  },
  enterprise: {
    maxAcademies: 999,
    maxClassesPerMonth: Infinity,
    maxClassHoursPerMonth: Infinity,
    maxReportsPerMonth: Infinity,
    maxStudentsPerRoom: 50,
    maxStorageBytes: 536_870_912_000,      // 500 GB
    maxAiTokensPerMonth: Infinity,
    maxTtsCharactersPerMonth: Infinity,
    integrations: true,
    academyLanding: true,
  },
};
```

---

## 5. Sistema de Permisos - Plantillas de Rol

```typescript
enum Permission {
  // Clases
  CLASSES_VIEW, CLASSES_CREATE, CLASSES_EDIT, CLASSES_CANCEL,
  // Contenido
  COURSES_VIEW, COURSES_MANAGE,
  LESSONS_VIEW, LESSONS_MANAGE,
  EXERCISES_VIEW, EXERCISES_MANAGE,
  LEARNING_PATHS_VIEW, LEARNING_PATHS_MANAGE,
  MEDIA_VIEW, MEDIA_MANAGE,
  // Personas
  STUDENTS_VIEW, STUDENTS_CREATE, STUDENTS_DEACTIVATE,
  TEACHERS_VIEW, TEACHERS_APPROVE,
  // Financiero
  FINANCINGS_VIEW_KPIS, FINANCINGS_MANAGE_PLANS,
  // Team
  TEAM_VIEW, TEAM_INVITE, TEAM_EDIT_ROLES,
  // Integraciones
  INTEGRATIONS_VIEW, INTEGRATIONS_MANAGE,
  // Settings
  ACADEMY_SETTINGS,
}

const ROLE_TEMPLATES = {
  admin: Object.values(Permission),  // todos
  content_manager: [
    COURSES_VIEW, COURSES_MANAGE,
    LESSONS_VIEW, LESSONS_MANAGE,
    EXERCISES_VIEW, EXERCISES_MANAGE,
    LEARNING_PATHS_VIEW, LEARNING_PATHS_MANAGE,
    MEDIA_VIEW, MEDIA_MANAGE,
    CLASSES_VIEW,
  ],
  financing: [
    FINANCINGS_VIEW_KPIS, FINANCINGS_MANAGE_PLANS,
    STUDENTS_VIEW,
  ],
  coordinator: [
    CLASSES_VIEW, CLASSES_CREATE, CLASSES_EDIT, CLASSES_CANCEL,
    STUDENTS_VIEW, STUDENTS_CREATE, STUDENTS_DEACTIVATE,
    TEACHERS_VIEW, TEACHERS_APPROVE,
  ],
};
```

---

## 6. Plan de Implementacion

### Fase 1: Fundamentos (Backend)
> Entidades base, auth, permisos

| # | Tarea | Archivos principales |
|---|-------|---------------------|
| 1.1 | Crear entidades: `AcademyLevel`, `AcademyLanguage` | `apps/api/src/database/entities/` |
| 1.2 | Crear entidad `Course`, `CourseLesson` | entities + migration |
| 1.3 | Reemplazar `LearningPathLesson` por `LearningPathCourse` | entities + migration |
| 1.4 | Crear entidad `AcademyPlan` (planes para estudiantes) | entity + migration |
| 1.5 | Crear entidad `StudentSubscription` | entity + migration |
| 1.6 | Crear entidad `TeacherApplication` + `ApplicationCustomField` | entities + migration |
| 1.7 | Crear entidad `TeamMember` (reemplaza `AcademyMember`) + migration datos existentes | entity + migration |
| 1.8 | Crear entidad `RoleTemplate` + seed plantillas default | entity + migration + seed |
| 1.9 | Crear entidad `OnboardingProgress` | entity + migration |
| 1.10 | Crear entidad `AcademyLanding` | entity + migration |
| 1.11 | Actualizar `Academy`: `stripeConnectAccountId`, `onboardingCompleted` | entity + migration |
| 1.12 | Actualizar `Student`: `isActive` soft delete | entity + migration |
| 1.13 | Actualizar `Class`: `zoomLink` nullable | entity + migration |
| 1.14 | Actualizar `Lesson`, `Exercise`: FK idioma + nivel | entities + migration |
| 1.15 | Actualizar `PLAN_LIMITS` en `@langopia/shared` | `packages/shared/src/types/index.ts` |
| 1.16 | Nuevo `Permission` enum + `ROLE_TEMPLATES` en `@langopia/shared` | shared types |

### Fase 2: API Modules (Backend)
> Endpoints NestJS para cada seccion

| # | Tarea | Modulo NestJS |
|---|-------|--------------|
| 2.1 | `AcademyLevelsModule` - CRUD niveles por academia | `apps/api/src/academy-levels/` |
| 2.2 | `AcademyLanguagesModule` - CRUD idiomas por academia | `apps/api/src/academy-languages/` |
| 2.3 | `CoursesModule` - CRUD cursos, asociar lessons, filtrar por idioma/nivel | `apps/api/src/courses/` |
| 2.4 | Actualizar `LearningPathsModule` - usar Courses en vez de Lessons | `apps/api/src/learning-paths/` |
| 2.5 | `AcademyPlansModule` - CRUD planes de estudiante | `apps/api/src/academy-plans/` |
| 2.6 | `StudentSubscriptionsModule` - suscribir, cancelar, listar | `apps/api/src/student-subscriptions/` |
| 2.7 | Stripe Connect: onboarding, crear cuenta conectada, webhooks | `apps/api/src/stripe/` |
| 2.8 | `TeacherApplicationsModule` - enviar, listar, aprobar/rechazar | `apps/api/src/teacher-applications/` |
| 2.9 | `TeamModule` - CRUD staff, roles, permisos, invitaciones | `apps/api/src/team/` |
| 2.10 | `FinancingsModule` - KPIs, revenue, agrupacion por periodo | `apps/api/src/financings/` |
| 2.11 | `OnboardingModule` - tracking tutoriales vistos | `apps/api/src/onboarding/` |
| 2.12 | `AcademyLandingModule` - config landing por academia | `apps/api/src/academy-landing/` |
| 2.13 | Actualizar `ClassesModule` - soporte Zoom link | `apps/api/src/classes/` |
| 2.14 | Actualizar `StudentsModule` - soft delete, filtros idioma/nivel | `apps/api/src/students/` |
| 2.15 | Actualizar `LessonsModule` - filtros idioma/nivel | `apps/api/src/lessons/` |
| 2.16 | Actualizar `ExercisesModule` - filtros idioma/nivel | `apps/api/src/exercises/` |
| 2.17 | Actualizar `@langopia/api-client` con todos los nuevos endpoints | `packages/api-client/` |

### Fase 3: Web SaaS (Frontend)
> Dashboard pages con Soft UI / Modern Dark-Light

| # | Tarea | Ruta |
|---|-------|------|
| 3.1 | Onboarding wizard (registro academia multi-step) | `/onboarding/*` |
| 3.2 | Stripe Connect onboarding flow | `/onboarding/payouts` |
| 3.3 | Overview global (metricas cross-academia) | `/dashboard/overview` |
| 3.4 | Selector de academia (switcher en sidebar) | Layout component |
| 3.5 | Clases - calendario (crear, editar, cancelar, LiveKit/Zoom) | `/dashboard/[academyId]/classes` |
| 3.6 | Cursos - CRUD con filtros idioma/nivel | `/dashboard/[academyId]/courses` |
| 3.7 | Lessons - CRUD con filtros idioma/nivel | `/dashboard/[academyId]/lessons` |
| 3.8 | Exercise Bank - manual + IA, filtros | `/dashboard/[academyId]/exercises` |
| 3.9 | Learning Path - builder con cursos | `/dashboard/[academyId]/learning-paths` |
| 3.10 | Media Library | `/dashboard/[academyId]/media` |
| 3.11 | Students - lista, perfil completo, soft delete | `/dashboard/[academyId]/students` |
| 3.12 | Teachers - lista, perfiles, aplicaciones, aprobar/rechazar | `/dashboard/[academyId]/teachers` |
| 3.13 | Financings - planes, KPIs, revenue, graficas | `/dashboard/[academyId]/financings` |
| 3.14 | Team - staff, roles, permisos, invitaciones | `/dashboard/[academyId]/team` |
| 3.15 | Integraciones - API keys | `/dashboard/[academyId]/integrations` |
| 3.16 | Tutorial in-app system (tooltips/overlays por seccion) | Componente global |
| 3.17 | Settings (perfil, suscripcion Langopia) | `/dashboard/settings` |

### Fase 4: Landing por Academia
> Tenant-based landing para Enterprise

| # | Tarea |
|---|-------|
| 4.1 | Ruta dinamica para landing de academia: `[slug].langopia.com` o `/a/[slug]` |
| 4.2 | Pagina publica: info academia, planes estudiante, registro + pago |
| 4.3 | Seccion profesor: formulario de aplicacion |
| 4.4 | Personalizar: logo, colores, textos desde el SaaS |

### Fase 5: Graficas y Metricas
> Charts modernos para Overview y Financings

| # | Tarea |
|---|-------|
| 5.1 | Seleccionar libreria de charts (Recharts o Tremor) |
| 5.2 | Overview: clases del mes, estudiantes activos, revenue, horas de clase |
| 5.3 | Financings: revenue chart, comparacion periodos, breakdown por plan |
| 5.4 | Students: progreso learning path chart, actividad |
| 5.5 | Teachers: horas, valoraciones, distribucion alumnos |

---

## 7. Orden de Ejecucion Recomendado

```
Fase 1 (Entidades + Shared)
    |
    v
Fase 2 (API Modules)
    |
    +-------+-------+
    |       |       |
    v       v       v
  Fase 3  Fase 4  Fase 5
  (Web)  (Landing) (Charts)
```

Fases 3, 4 y 5 pueden ejecutarse en paralelo una vez Fase 2 este completa.
Dentro de Fase 3, el onboarding wizard (3.1-3.2) es prioritario ya que desbloquea el uso de todo lo demas.
