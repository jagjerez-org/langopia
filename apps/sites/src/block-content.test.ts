import { describe, expect, it } from "vitest";

import { faqItems, heroContent, textContent } from "./block-content";

describe("block content normalization", () => {
  it("normalizes canonical hero props", () => {
    expect(
      heroContent({
        headline: "Aprende inglés",
        subtitle: "Grupos reducidos",
        image: { url: "https://cdn.test/hero.jpg", alt: "Clase" },
        callToAction: { label: "Reservar", href: "/contacto" },
      }),
    ).toEqual({
      headline: "Aprende inglés",
      subtitle: "Grupos reducidos",
      imageUrl: "https://cdn.test/hero.jpg",
      imageAlt: "Clase",
      ctaLabel: "Reservar",
      ctaHref: "/contacto",
    });
  });

  it("normalizes seeded hero props", () => {
    expect(
      heroContent({
        headline: "Aprende inglés",
        subheadline: "Con profesores expertos",
        imageKey: "demo/site/hero.webp",
        cta: { label: "Prueba tu nivel", href: "/contacto" },
      }),
    ).toMatchObject({
      subtitle: "Con profesores expertos",
      imageUrl: "/demo/site/hero.webp",
      ctaLabel: "Prueba tu nivel",
    });
  });

  it("normalizes faq item aliases", () => {
    expect(faqItems({ items: [{ q: "¿Hay prueba?", a: "Sí." }] })).toEqual([
      { question: "¿Hay prueba?", answer: "Sí." },
    ]);
  });

  it("renders safe text nodes from limited rich text and legacy html", () => {
    expect(textContent({ content: [{ kind: "heading", text: "Cursos" }] })).toEqual([
      { kind: "heading", text: "Cursos" },
    ]);
    expect(textContent({ html: "<h1>Cursos</h1><p>De A1 a C2.</p><script>alert(1)</script>" })).toEqual([
      { kind: "heading", text: "Cursos" },
      { kind: "paragraph", text: "De A1 a C2." },
    ]);
  });
});
