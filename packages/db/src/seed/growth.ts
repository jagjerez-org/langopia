/**
 * Datos de las olas 2, 3 y 4.
 *
 * Existe para que el desarrollo de esas olas **no se bloquee esperando datos
 * reales**. Sin esto, la analítica no se puede probar hasta tener tres meses
 * de un cliente, y el constructor de webs hasta tener escuelas que lo usen —lo
 * que significa no poder construirlo.
 *
 * Aquí se siembra el estado al que se llegaría después de meses de uso: un
 * sitio publicado, un embudo de captación con candidatos en cada fase, un
 * banco de nivelación calibrado, autorizaciones MCP vivas e histórico
 * suficiente para que una media móvil signifique algo.
 */
import * as s from "../schema/index.js";
import type { SchoolBuilder } from "./builders.js";
import { daysAgo, daysFromNow, isoDate, NOW, pick, randomInt, weeksAgo } from "./helpers.js";

/* ─── Sitio web (ola 4) ────────────────────────────────────────────────── */

export async function seedSite(
  b: SchoolBuilder,
  opts: {
    locales: string[];
    published: boolean;
    theme: { primaryColor: string; accentColor: string };
    courseIds: string[];
    teacherProfileIds: string[];
  },
) {
  const [site] = await b.db
    .insert(s.sites)
    .values({
      schoolId: b.id,
      status: opts.published ? "published" : "draft",
      primaryLocale: opts.locales[0]!,
      theme: opts.theme,
      publishedAt: opts.published ? weeksAgo(6) : null,
      createdAt: weeksAgo(8),
    })
    .returning();

  const paginas = [
    { slug: "", title: "Inicio", isHome: true, position: 0 },
    { slug: "cursos", title: "Cursos", isHome: false, position: 1 },
    { slug: "profesorado", title: "Profesorado", isHome: false, position: 2 },
    { slug: "contacto", title: "Contacto", isHome: false, position: 3 },
  ];

  const creadas = [];
  for (const locale of opts.locales) {
    for (const pagina of paginas) {
      const [row] = await b.db
        .insert(s.sitePages)
        .values({
          schoolId: b.id,
          siteId: site!.id,
          slug: pagina.slug,
          locale,
          title: pagina.title,
          metaDescription:
            pagina.isHome
              ? `${b.school.name} — clases de idiomas online con profesorado titulado.`
              : `${pagina.title} · ${b.school.name}`,
          isHome: pagina.isHome,
          position: pagina.position,
          publishedAt: opts.published ? weeksAgo(6) : null,
        })
        .returning();
      creadas.push({ page: row!, kind: pagina.slug, locale });
    }
  }

  // Bloques de cada página. La portada lleva el catálogo completo; el resto,
  // lo suyo. Es el catálogo cerrado del plan de la ola 4.
  for (const { page, kind } of creadas) {
    const bloques: Array<{ type: (typeof s.blockType.enumValues)[number]; content: Record<string, unknown> }> =
      kind === ""
        ? [
            {
              type: "hero",
              content: {
                headline: "Aprende idiomas con profesorado que te conoce",
                subheadline: "Grupos de cinco alumnos como máximo. Clases de 60 minutos.",
                imageKey: `${b.spec.slug}/site/hero.webp`,
                cta: { label: "Prueba tu nivel gratis", href: "/contacto" },
              },
            },
            { type: "courses", content: { courseIds: opts.courseIds.slice(0, 3), showPrices: true } },
            { type: "teachers", content: { teacherProfileIds: opts.teacherProfileIds.slice(0, 4) } },
            {
              type: "testimonials",
              content: { maxItems: 3, minRating: 4 },
            },
            {
              type: "faq",
              content: {
                items: [
                  { q: "¿Cuánto dura cada clase?", a: "Sesenta minutos, con un máximo de cinco alumnos." },
                  { q: "¿Puedo cambiar de horario?", a: "Sí, avisando con 24 horas de antelación." },
                  { q: "¿Hay prueba de nivel?", a: "Sí, gratuita y en cinco minutos." },
                ],
              },
            },
            { type: "contact", content: { showPhone: true, askLanguage: true } },
          ]
        : kind === "cursos"
          ? [
              { type: "text", content: { html: "<h1>Nuestros cursos</h1><p>De A1 a C2, con material propio.</p>" } },
              { type: "courses", content: { courseIds: opts.courseIds, showPrices: true } },
              { type: "pricing", content: { highlightPlan: "growth" } },
            ]
          : kind === "profesorado"
            ? [
                { type: "text", content: { html: "<h1>Quién te va a dar clase</h1>" } },
                { type: "teachers", content: { teacherProfileIds: opts.teacherProfileIds } },
              ]
            : [
                { type: "text", content: { html: "<h1>Hablemos</h1><p>Te respondemos en menos de 24 horas.</p>" } },
                { type: "contact", content: { showPhone: true, askLanguage: true } },
              ];

    await b.db.insert(s.siteBlocks).values(
      bloques.map((bloque, i) => ({
        schoolId: b.id,
        pageId: page.id,
        type: bloque.type,
        position: i,
        content: bloque.content,
        isVisible: true,
      })),
    );
  }

  return site!;
}

/* ─── Embudo de captación (ola 4) ──────────────────────────────────────── */

/**
 * Candidatos en TODOS los estados del embudo, para que la pantalla no salga
 * con una sola columna llena.
 */
export async function seedLeads(
  b: SchoolBuilder,
  opts: {
    courseIds: string[];
    convertedStudentProfileId: string;
    assignedToMembershipId: string;
  },
) {
  const nombres = [
    "Adriana Peña", "Borja Uriarte", "Cintia Roldán", "Dídac Ferrán", "Eva Santamaría",
    "Fabio Lorenzo", "Gala Herrero", "Hernán Bustillo", "Inés Carrasco", "Joan Miralles",
    "Katia Belenguer", "Luis Ontiveros", "Marta Segura", "Nico Vilaplana", "Olga Ferrer",
    "Pau Cardona", "Queralt Vives", "Ramón Pedraza", "Sonia Escrivá", "Tomás Gallardo",
  ];
  const paginas = ["/", "/cursos", "/profesorado", "/contacto"];
  const campanias = [null, "google-ads-verano", "instagram-septiembre", "recomendacion"];

  const estados: Array<{
    status: (typeof s.leadStatus.enumValues)[number];
    n: number;
    dias: [number, number];
  }> = [
    { status: "new", n: 4, dias: [0, 3] },
    { status: "placement_sent", n: 3, dias: [2, 6] },
    { status: "placement_done", n: 4, dias: [4, 12] },
    { status: "contacted", n: 3, dias: [6, 20] },
    { status: "converted", n: 2, dias: [20, 45] },
    { status: "cold", n: 3, dias: [40, 75] },
    { status: "discarded", n: 1, dias: [30, 60] },
  ];

  let i = 0;
  const creados = [];
  for (const grupo of estados) {
    for (let k = 0; k < grupo.n; k++) {
      const nombre = nombres[i % nombres.length]!;
      i++;
      const creado = daysAgo(randomInt(grupo.dias[0], grupo.dias[1]));
      const hizoPrueba = ["placement_done", "contacted", "converted"].includes(grupo.status);
      const nivel = pick(["A1", "A2", "B1", "B2"] as const);

      const [row] = await b.db
        .insert(s.leads)
        .values({
          schoolId: b.id,
          name: nombre,
          email: `${nombre.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, ".")}@ejemplo.test`,
          phone: `+34 6${randomInt(10, 99)} ${randomInt(100, 999)} ${randomInt(100, 999)}`,
          locale: b.spec.defaultLocale,
          message:
            grupo.status === "new"
              ? "Me gustaría saber horarios y precios de los grupos de tarde."
              : null,
          interestedLanguage: pick(["es", "en", "fr"]),
          declaredLevel: nivel,
          // El nivel declarado y el real casi nunca coinciden: es justo el
          // motivo de que exista la prueba.
          placementLevel: hizoPrueba ? pick(["A1", "A2", "B1"] as const) : null,
          placementScore: hizoPrueba ? randomInt(28, 88) : null,
          suggestedCourseId: hizoPrueba ? pick(opts.courseIds) : null,
          status: grupo.status,
          sourcePage: pick(paginas),
          sourceCampaign: pick(campanias),
          referrer: pick([null, "https://www.google.com/", "https://www.instagram.com/"]),
          convertedStudentProfileId:
            grupo.status === "converted" ? opts.convertedStudentProfileId : null,
          convertedAt: grupo.status === "converted" ? daysAgo(randomInt(5, 20)) : null,
          assignedToMembershipId: grupo.status === "new" ? null : opts.assignedToMembershipId,
          createdAt: creado,
          lastContactedAt: grupo.status === "new" ? null : daysAgo(randomInt(1, 15)),
          discardedReason: grupo.status === "discarded" ? "Buscaba clases presenciales" : null,
        })
        .returning();
      creados.push(row!);
    }
  }
  return creados;
}

/* ─── Banco de nivelación (ola 2) ──────────────────────────────────────── */

/**
 * Ítems calibrados por nivel y destreza. La dificultad observada permite que
 * el algoritmo adaptativo elija la siguiente pregunta con criterio en vez de
 * al azar.
 */
export async function seedPlacementBank(b: SchoolBuilder, language: string) {
  const niveles = ["A1", "A2", "B1", "B2", "C1"] as const;
  const destrezas = ["grammar", "vocabulary", "reading", "listening"];

  const banco: Array<typeof s.placementItems.$inferInsert> = [];
  for (const nivel of niveles) {
    for (const destreza of destrezas) {
      for (let n = 1; n <= 3; n++) {
        const usos = randomInt(40, 400);
        // Los ítems de nivel bajo se aciertan más: la dificultad observada
        // debe reflejarlo o el algoritmo se descalibra.
        const baseAcierto = { A1: 0.85, A2: 0.72, B1: 0.58, B2: 0.44, C1: 0.31 }[nivel];
        const aciertos = Math.round(usos * (baseAcierto + (randomInt(-8, 8) / 100)));

        banco.push({
          schoolId: b.id,
          language,
          level: nivel,
          skill: destreza,
          difficulty: Math.round((1 - aciertos / usos) * 10_000),
          prompt: {
            question: `Ítem ${nivel}-${destreza}-${n}`,
            options: ["Opción A", "Opción B", "Opción C", "Opción D"],
          },
          solution: { correct: randomInt(0, 3) },
          timesUsed: usos,
          timesCorrect: aciertos,
          isActive: true,
          createdAt: weeksAgo(randomInt(4, 20)),
        });
      }
    }
  }

  await b.db.insert(s.placementItems).values(banco);
  return banco.length;
}

/* ─── Autorizaciones MCP (ola 3) ───────────────────────────────────────── */

export async function seedMcpAuthorizations(
  b: SchoolBuilder,
  opts: Array<{
    mcpClientId: string;
    membershipId: string;
    scopes: string[];
    revoked?: boolean;
    expired?: boolean;
  }>,
) {
  await b.db.insert(s.mcpAuthorizations).values(
    opts.map((o) => ({
      schoolId: b.id,
      mcpClientId: o.mcpClientId,
      membershipId: o.membershipId,
      scopes: o.scopes,
      accessTokenHash: `$argon2id$seed$at_${o.mcpClientId.slice(0, 8)}`,
      refreshTokenHash: `$argon2id$seed$rt_${o.mcpClientId.slice(0, 8)}`,
      expiresAt: o.expired ? daysAgo(2) : daysFromNow(30),
      lastUsedAt: o.revoked ? weeksAgo(5) : daysAgo(randomInt(0, 3)),
      revokedAt: o.revoked ? weeksAgo(4) : null,
      createdAt: weeksAgo(randomInt(6, 20)),
    })),
  );
}

/* ─── Histórico para la analítica (ola 3) ──────────────────────────────── */

/**
 * Amplía encuestas y valoraciones hacia atrás.
 *
 * La analítica de la ola 3 —NPS trimestral, tendencia de satisfacción, riesgo
 * de baja— necesita profundidad. Con ocho semanas de datos, una media móvil
 * de trimestre no existe. Se siembran 26 semanas: dos trimestres completos,
 * que es lo mínimo para poder comparar uno con otro.
 */
export async function seedAnalyticsHistory(
  b: SchoolBuilder,
  opts: {
    npsSurveyId: string;
    csatSurveyId: string;
    studentMembershipIds: string[];
    teacherProfileIds: string[];
    teacherMembershipIds: string[];
    studentProfileIds: string[];
    // Sesiones reales de la escuela a las que anclar el histórico. La regla de
    // unicidad de `survey_responses` —una respuesta por encuesta, persona y
    // sesión— impide sembrar varias oleadas con `session_id` nulo, así que
    // cada respuesta histórica se ancla a una sesión distinta.
    sessionIds: string[];
  },
) {
  let sessionCursor = 0;
  const claimSessionId = () => opts.sessionIds[sessionCursor++ % opts.sessionIds.length]!;

  // NPS: una oleada por trimestre, con tendencia de mejora lenta.
  for (const [t, semanas] of [[0, 24], [1, 12], [2, 2]] as const) {
    const sesgo = t; // los trimestres recientes puntúan algo mejor
    for (const membershipId of opts.studentMembershipIds.slice(0, 26)) {
      await b.surveyResponse({
        surveyId: opts.npsSurveyId,
        respondentMembershipId: membershipId,
        respondentKind: "student",
        sessionId: claimSessionId(),
        score: Math.min(10, pick([10, 9, 9, 8, 8, 7, 6, 5]) + (sesgo > 1 ? 1 : 0)),
        submittedAt: weeksAgo(semanas),
      });
    }
  }

  // CSAT: respuestas repartidas a lo largo de 26 semanas.
  for (let semana = 26; semana >= 1; semana -= 2) {
    for (const membershipId of opts.studentMembershipIds.slice(0, 6)) {
      await b.surveyResponse({
        surveyId: opts.csatSurveyId,
        respondentMembershipId: membershipId,
        respondentKind: "student",
        sessionId: claimSessionId(),
        teacherProfileId: pick(opts.teacherProfileIds),
        score: pick([5, 5, 4, 4, 4, 3, 2]),
        submittedAt: weeksAgo(semana),
      });
    }
  }

  // Valoraciones trimestrales de profesor a alumno, que es lo que alimenta
  // «alumnos sin valorar» y la productividad docente.
  const textos = [
    { s: "Progresa con constancia y participa mucho.", i: "Ampliar vocabulario formal.", n: "Preparar la presentación oral del próximo trimestre." },
    { s: "Muy buena comprensión lectora.", i: "La expresión escrita necesita más práctica.", n: "Dos redacciones por semana." },
    { s: "Excelente pronunciación.", i: "Perder el miedo a intervenir en grupo.", n: "Trabajo en parejas las próximas cuatro clases." },
  ];

  for (const [i, studentProfileId] of opts.studentProfileIds.slice(0, 18).entries()) {
    // Dos periodos por alumno: uno hace tres meses y otro reciente.
    for (const [inicio, fin] of [[26, 14], [13, 2]] as const) {
      const texto = textos[i % textos.length]!;
      await b.evaluation({
        teacherProfileId: opts.teacherProfileIds[i % opts.teacherProfileIds.length]!,
        studentProfileId,
        periodStart: weeksAgo(inicio),
        periodEnd: weeksAgo(fin),
        progressRating: randomInt(2, 5),
        strengths: texto.s,
        improvements: texto.i,
        nextSteps: texto.n,
        createdAt: weeksAgo(fin),
      });
    }
  }

  // Pulso del profesorado: mensual, seis meses hacia atrás.
  for (let mes = 6; mes >= 1; mes--) {
    for (const membershipId of opts.teacherMembershipIds) {
      await b.surveyResponse({
        surveyId: opts.csatSurveyId,
        respondentMembershipId: membershipId,
        respondentKind: "teacher",
        sessionId: claimSessionId(),
        score: pick([5, 4, 4, 3]),
        submittedAt: weeksAgo(mes * 4),
      });
    }
  }
}

export { isoDate, NOW };
