import { describe, expect, it } from "vitest";
import { Block, SiteBlockType } from "./block.vo.js";

const COURSE_ID = "11111111-1111-4111-8111-111111111111";
const TEACHER_WITH_RIGHTS = {
  teacherId: "22222222-2222-4222-8222-222222222222",
  displayName: "Ana Ruiz",
  imageUrl: "https://cdn.langopia.test/ana.jpg",
  imageRights: true,
};
const TEACHER_WITHOUT_RIGHTS = {
  teacherId: "33333333-3333-4333-8333-333333333333",
  displayName: "Luis Mora",
  imageUrl: "https://cdn.langopia.test/luis.jpg",
  imageRights: false,
};

describe("Block", () => {
  it("acepta un hero con titular, subtítulo, imagen y llamada a la acción", () => {
    const block = Block.hero({
      id: "hero-1",
      headline: "Inglés real para equipos",
      subtitle: "Clases útiles desde la primera semana",
      image: { url: "https://cdn.langopia.test/hero.jpg", alt: "Clase de inglés" },
      callToAction: { label: "Reservar prueba", href: "/contacto" },
    });

    expect(block.type).toBe(SiteBlockType.Hero);
  });

  it("acepta cursos como catálogo real, no texto libre", () => {
    const allCourses = Block.courses({ id: "courses-all", source: { kind: "all_active" } });
    const selectedCourses = Block.courses({
      id: "courses-selected",
      source: { kind: "selected", courseIds: [COURSE_ID] },
    });

    expect(allCourses.courseSource.kind).toBe("all_active");
    expect(selectedCourses.courseSource.kind).toBe("selected");
  });

  it("representa profesorado filtrando quienes no tengan image_rights", () => {
    const block = Block.teachers({
      id: "teachers-1",
      teachers: [TEACHER_WITH_RIGHTS, TEACHER_WITHOUT_RIGHTS],
    });

    expect(block.visibleTeachers).toEqual([TEACHER_WITH_RIGHTS]);
  });

  it("acepta precios como referencias a planes reales", () => {
    const block = Block.pricing({
      id: "pricing-1",
      planIds: ["44444444-4444-4444-8444-444444444444"],
    });

    expect(block.planIds).toEqual(["44444444-4444-4444-8444-444444444444"]);
  });

  it("representa solo reseñas marcadas como públicas por su autor", () => {
    const block = Block.testimonials({
      id: "testimonials-1",
      testimonials: [
        {
          testimonialId: "55555555-5555-4555-8555-555555555555",
          authorName: "María",
          quote: "Aprobé el B2 con confianza.",
          public: true,
        },
        {
          testimonialId: "66666666-6666-4666-8666-666666666666",
          authorName: "Carlos",
          quote: "No publicar.",
          public: false,
        },
      ],
    });

    expect(block.publicTestimonials).toHaveLength(1);
    expect(block.publicTestimonials[0]!.authorName).toBe("María");
  });

  it("acepta preguntas frecuentes con pregunta y respuesta", () => {
    const block = Block.faq({
      id: "faq-1",
      items: [{ question: "¿Hay prueba de nivel?", answer: "Sí, antes de matricularte." }],
    });

    expect(block.faqItems).toHaveLength(1);
  });

  it("acepta un bloque de contacto que apunta al formulario de captación", () => {
    const block = Block.contact({
      id: "contact-1",
      title: "Pide información",
      submitLabel: "Enviar",
      leadSource: "school_site",
    });

    expect(block.leadSource).toBe("school_site");
  });

  it("acepta texto enriquecido deliberadamente limitado", () => {
    const block = Block.text({
      id: "text-1",
      content: [
        { kind: "paragraph", text: "Cursos intensivos y extensivos durante todo el año." },
        { kind: "heading", text: "Metodología" },
      ],
    });

    expect(block.richText).toHaveLength(2);
  });

  it("rechaza tipos fuera del catálogo cerrado de ocho bloques", () => {
    expect(() =>
      Block.from({
        id: "bad-1",
        type: "gallery",
        props: {},
      }),
    ).toThrow(/bloque/);
  });
});
