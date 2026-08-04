/**
 * Navegación del panel según el rol de la sesión (Tarea 11, Paso 1: «Portal
 * del alumno, con navegación distinta según el rol de la sesión»).
 *
 * Hasta esta tarea, ninguna pantalla necesitaba un menú: dirección,
 * profesorado y alumnado (desde su ficha) llegaban por enlaces sueltos o
 * escribiendo la URL. El portal del alumno es la primera que convive con
 * roles que ven cosas DISTINTAS por defecto — el fallo por defecto es
 * denegar (`OLA-1-WEB.md`), así que este menú solo ofrece lo que el rol
 * puede de verdad abrir, nunca un enlace que llevaría a un 403.
 *
 * Una membresía puede tener más de un rol A LA VEZ en la misma escuela (el
 * índice único de `memberships` es `(school_id, user_id, role)`, no
 * `(school_id, user_id)`): quien es a la vez `owner` y `teacher` ve la unión
 * de los dos conjuntos de enlaces, sin duplicados.
 */
export type NavLink = {
  to: string;
  labelKey: string;
};

const DIRECTION_LINKS: NavLink[] = [
  { to: "/", labelKey: "nav.dashboard" },
  { to: "/analitica", labelKey: "nav.analytics" },
  { to: "/candidatos", labelKey: "nav.leads" },
  { to: "/transcripciones", labelKey: "nav.transcripts" },
  { to: "/web/editor", labelKey: "nav.siteEditor" },
  { to: "/web/dominios", labelKey: "nav.siteDomains" },
  { to: "/alumnos", labelKey: "nav.students" },
  { to: "/calendario", labelKey: "nav.calendar" },
  { to: "/contenido", labelKey: "nav.generateContent" },
  { to: "/correcciones", labelKey: "nav.corrections" },
  // Tarea 17, paso 12: la auditoría de impersonaciones la ve dirección.
  { to: "/impersonaciones", labelKey: "nav.impersonationHistory" },
];

const TEACHER_LINKS: NavLink[] = [
  { to: "/alumnos", labelKey: "nav.students" },
  { to: "/calendario", labelKey: "nav.calendar" },
  { to: "/contenido", labelKey: "nav.generateContent" },
  { to: "/correcciones", labelKey: "nav.corrections" },
];

const PORTAL_LINKS: NavLink[] = [
  { to: "/mi/clases", labelKey: "nav.mySessions" },
  { to: "/mi/facturas", labelKey: "nav.myInvoices" },
  { to: "/mi/asistencia", labelKey: "nav.myAttendance" },
  { to: "/mi/progreso", labelKey: "nav.myProgress" },
  { to: "/mi/ejercicios", labelKey: "nav.myExercises" },
  { to: "/mi/repaso", labelKey: "nav.myReview" },
];

export function navLinksForRoles(roles: readonly string[]): NavLink[] {
  const links: NavLink[] = [];
  const seen = new Set<string>();
  const add = (candidates: NavLink[]): void => {
    for (const link of candidates) {
      if (seen.has(link.to)) continue;
      seen.add(link.to);
      links.push(link);
    }
  };

  if (roles.includes("owner") || roles.includes("admin")) add(DIRECTION_LINKS);
  if (roles.includes("teacher")) add(TEACHER_LINKS);
  if (roles.includes("student") || roles.includes("guardian")) add(PORTAL_LINKS);

  return links;
}
