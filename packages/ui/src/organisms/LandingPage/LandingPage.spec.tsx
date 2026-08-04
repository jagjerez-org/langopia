import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import {
  landingContent,
  landingFooter,
  landingHeader,
  landingHero,
  landingPricing,
} from "../../fixtures/landing.js";
import { LandingPage } from "./LandingPage.js";
import type { LandingPageProps } from "./LandingPage.js";

const baseProps: LandingPageProps = landingContent;

describe("LandingPage", () => {
  it("renderiza los landmarks header, main y footer", () => {
    render(<LandingPage {...baseProps} />);

    expect(screen.getByRole("banner")).toBeDefined();
    expect(screen.getByRole("main")).toBeDefined();
    expect(screen.getByRole("contentinfo")).toBeDefined();
  });

  it("tiene un único h1, el titular del hero", () => {
    render(<LandingPage {...baseProps} />);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]!.textContent).toBe(landingHero.title);
    // El h1 vive dentro de main, no en la cabecera.
    expect(within(screen.getByRole("main")).getByRole("heading", { level: 1 })).toBeDefined();
  });

  it("cada sección está nombrada por su h2 vía aria-labelledby", () => {
    render(<LandingPage {...baseProps} />);

    const main = screen.getByRole("main");
    const sections = within(main).getAllByRole("region");
    // Hero, características, módulos, precios y CTA final.
    expect(sections).toHaveLength(5);
    for (const section of sections) {
      const labelId = section.getAttribute("aria-labelledby");
      expect(labelId).toBeTruthy();
      const heading = document.getElementById(labelId!);
      expect(heading).not.toBeNull();
      expect(heading!.tagName).toMatch(/^H[12]$/);
      expect(section.contains(heading)).toBe(true);
    }
  });

  it("mantiene la jerarquía de headings: h2 de sección y h3 de items", () => {
    render(<LandingPage {...baseProps} />);

    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(4);
    // 6 características + 4 módulos + 3 planes = 13 items con h3.
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(13);
  });

  it("los CTAs y enlaces apuntan a sus hrefs", () => {
    render(<LandingPage {...baseProps} />);

    expect(screen.getByRole("link", { name: "Empezar gratis" }).getAttribute("href")).toBe("/registro");
    expect(screen.getByRole("link", { name: "Ver demo" }).getAttribute("href")).toBe("/demo");
    expect(screen.getByRole("link", { name: "Iniciar sesión" }).getAttribute("href")).toBe("/login");
    // La marca enlaza al inicio y lleva el nombre del producto.
    expect(
      within(screen.getByRole("banner"))
        .getByRole("link", { name: landingHeader.brandName })
        .getAttribute("href"),
    ).toBe("/");
    // CTA de un plan y enlace del pie.
    expect(screen.getByRole("link", { name: "Elegir Academy" }).getAttribute("href")).toBe(
      "/registro?plan=academy",
    );
    expect(
      within(screen.getByRole("contentinfo"))
        .getByRole("link", { name: "Privacidad" })
        .getAttribute("href"),
    ).toBe("/privacidad");
  });

  it("las navegaciones de cabecera y pie llevan su nombre accesible", () => {
    render(<LandingPage {...baseProps} />);

    expect(screen.getByRole("navigation", { name: landingHeader.navAriaLabel })).toBeDefined();
    expect(screen.getByRole("navigation", { name: landingFooter.navAriaLabel })).toBeDefined();
  });

  it("renderiza características, módulos y planes con su contenido", () => {
    render(<LandingPage {...baseProps} />);

    expect(screen.getByRole("heading", { name: "Gestión de alumnos" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "E-learning" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Academy" })).toBeDefined();
    expect(screen.getByText("Recomendado")).toBeDefined();
    // El módulo enlaza la tarjeta entera.
    expect(screen.getByRole("link", { name: /Sites/ }).getAttribute("href")).toBe("/producto/sites");
    // Imagen del hero con su texto alternativo.
    expect(
      screen.getByAltText("Vista del panel de Langopia con el calendario de clases"),
    ).toBeDefined();
  });

  it("sin pricing no renderiza la sección de precios", () => {
    const { pricing: _pricing, ...withoutPricing } = baseProps;
    render(<LandingPage {...withoutPricing} />);

    expect(
      screen.queryByRole("heading", { name: landingPricing.title }),
    ).toBeNull();
    expect(screen.queryByRole("heading", { name: "Academy" })).toBeNull();
    // El resto de secciones siguen: 4 regiones en lugar de 5.
    expect(within(screen.getByRole("main")).getAllByRole("region")).toHaveLength(4);
  });

  it("sin imagen de hero ni CTAs de cabecera no renderiza esos huecos", () => {
    render(
      <LandingPage
        {...baseProps}
        header={{ ...landingHeader, loginAction: undefined, ctaAction: undefined }}
        hero={{ ...landingHero, image: undefined, secondaryAction: undefined }}
      />,
    );

    // Sin imagen de hero no hay <img> de cabecera (quedan las de los módulos).
    expect(
      screen.queryByAltText("Vista del panel de Langopia con el calendario de clases"),
    ).toBeNull();
    expect(screen.queryByRole("link", { name: "Iniciar sesión" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Ver demo" })).toBeNull();
    expect(screen.getByRole("link", { name: "Empezar gratis" })).toBeDefined();
  });
});
