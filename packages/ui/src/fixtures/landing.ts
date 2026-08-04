import { createElement } from "react";
import {
  IconAudio,
  IconCheckCircle,
  IconFile,
  IconImage,
  IconInbox,
  IconVideo,
} from "../atoms/Icons/Icons.js";
import type {
  LandingFeaturesContent,
  LandingFinalCtaContent,
  LandingFooterContent,
  LandingHeaderContent,
  LandingHeroContent,
  LandingModulesContent,
  LandingPageProps,
  LandingPricingContent,
} from "../organisms/LandingPage/LandingPage.js";

/**
 * Contenido ficticio completo para stories y specs de `LandingPage`:
 * cabecera, hero, 6 características, 4 módulos, 3 planes y pie.
 * Los iconos se crean con `createElement` porque el fichero es `.ts`
 * (convención del brief; el único fixture `.tsx` es `shell.tsx`).
 * Precios ya formateados: la moneda la decide la app.
 */

export const landingHeader: LandingHeaderContent = {
  brandName: "Langopia",
  brandHref: "/",
  navAriaLabel: "Navegación principal",
  navLinks: [
    { label: "Características", href: "#caracteristicas" },
    { label: "Producto", href: "#producto" },
    { label: "Precios", href: "#precios" },
  ],
  loginAction: { label: "Iniciar sesión", href: "/login" },
  ctaAction: { label: "Crear cuenta", href: "/registro" },
};

export const landingHero: LandingHeroContent = {
  title: "Tu academia de idiomas, en una sola plataforma",
  subtitle:
    "Gestiona alumnos, clases, pagos y contenido formativo sin salir de Langopia.",
  primaryAction: { label: "Empezar gratis", href: "/registro" },
  secondaryAction: { label: "Ver demo", href: "/demo", variant: "secondary" },
  image: {
    src: "https://picsum.photos/seed/langopia-hero/960/540",
    alt: "Vista del panel de Langopia con el calendario de clases",
  },
};

export const landingFeatures: LandingFeaturesContent = {
  title: "Todo lo que necesita tu academia",
  subtitle: "Herramientas pensadas para escuelas de idiomas de cualquier tamaño.",
  items: [
    {
      id: "feature-alumnos",
      icon: createElement(IconInbox),
      title: "Gestión de alumnos",
      description: "Fichas, asistencia y progreso de cada estudiante en un solo lugar.",
    },
    {
      id: "feature-clases",
      icon: createElement(IconVideo),
      title: "Clases en directo",
      description: "Videollamadas integradas con grabación y materiales compartidos.",
    },
    {
      id: "feature-audio",
      icon: createElement(IconAudio),
      title: "Ejercicios de audio",
      description: "Práctica de comprensión oral con corrección automática.",
    },
    {
      id: "feature-contenidos",
      icon: createElement(IconFile),
      title: "Biblioteca de contenidos",
      description: "Organiza documentos, vídeos y audios por curso y nivel.",
    },
    {
      id: "feature-multimedia",
      icon: createElement(IconImage),
      title: "Sites públicos",
      description: "Publica la web de tu academia con páginas y galerías propias.",
    },
    {
      id: "feature-resultados",
      icon: createElement(IconCheckCircle),
      title: "Informes y KPIs",
      description: "Métricas de retención, asistencia e ingresos siempre a mano.",
    },
  ],
};

export const landingModules: LandingModulesContent = {
  title: "Un producto, cuatro módulos",
  subtitle: "Activa solo lo que tu academia necesita.",
  items: [
    {
      id: "module-panel",
      title: "Panel de gestión",
      description: "Alumnos, profesores, planificación y cobros del día a día.",
      image: {
        src: "https://picsum.photos/seed/langopia-panel/640/360",
        alt: "Panel de gestión con la lista de alumnos",
      },
      href: "/producto/panel",
    },
    {
      id: "module-sites",
      title: "Sites",
      description: "La web pública de tu academia, editable sin tocar código.",
      image: {
        src: "https://picsum.photos/seed/langopia-sites/640/360",
        alt: "Editor visual de la web pública",
      },
      href: "/producto/sites",
    },
    {
      id: "module-elearning",
      title: "E-learning",
      description: "Cursos online con lecciones, ejercicios y seguimiento.",
      image: {
        src: "https://picsum.photos/seed/langopia-elearning/640/360",
        alt: "Lección de un curso online con ejercicios",
      },
      href: "/producto/elearning",
    },
    {
      id: "module-pagos",
      title: "Pagos",
      description: "Cobros, suscripciones y facturación conectados con Stripe.",
      image: {
        src: "https://picsum.photos/seed/langopia-pagos/640/360",
        alt: "Listado de pagos y suscripciones",
      },
      href: "/producto/pagos",
    },
  ],
};

export const landingPricing: LandingPricingContent = {
  title: "Precios sencillos",
  subtitle: "Sin permanencia. Cambia de plan cuando quieras.",
  plans: [
    {
      id: "plan-starter",
      name: "Starter",
      price: "29 €",
      period: "/mes",
      features: ["Hasta 50 alumnos", "Panel de gestión", "Soporte por correo"],
      cta: { label: "Elegir Starter", href: "/registro?plan=starter" },
    },
    {
      id: "plan-academy",
      name: "Academy",
      price: "79 €",
      period: "/mes",
      tag: "Recomendado",
      features: [
        "Hasta 300 alumnos",
        "Panel + Sites + E-learning",
        "Pagos con Stripe",
        "Soporte prioritario",
      ],
      cta: { label: "Elegir Academy", href: "/registro?plan=academy" },
    },
    {
      id: "plan-campus",
      name: "Campus",
      price: "149 €",
      period: "/mes",
      features: [
        "Alumnos ilimitados",
        "Todos los módulos",
        "Roles y permisos",
        "Gestor de cuenta dedicado",
      ],
      cta: { label: "Elegir Campus", href: "/registro?plan=campus" },
    },
  ],
};

export const landingFinalCta: LandingFinalCtaContent = {
  title: "Empieza hoy con tu academia",
  subtitle: "Crea tu cuenta en dos minutos y publica tu primer curso.",
  actions: [
    { label: "Crear cuenta", href: "/registro" },
    { label: "Hablar con ventas", href: "/contacto", variant: "secondary" },
  ],
};

export const landingFooter: LandingFooterContent = {
  navAriaLabel: "Navegación del pie",
  links: [
    { label: "Aviso legal", href: "/legal" },
    { label: "Privacidad", href: "/privacidad" },
    { label: "Cookies", href: "/cookies" },
    { label: "Contacto", href: "/contacto" },
  ],
  copyright: "© 2026 Langopia. Todos los derechos reservados.",
};

/** Contenido completo listo para pasar a `LandingPage` tal cual. */
export const landingContent: LandingPageProps = {
  header: landingHeader,
  hero: landingHero,
  features: landingFeatures,
  modules: landingModules,
  pricing: landingPricing,
  finalCta: landingFinalCta,
  footer: landingFooter,
};
