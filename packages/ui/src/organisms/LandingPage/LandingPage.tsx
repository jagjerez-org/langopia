import { useId } from "react";
import type { ReactElement, ReactNode } from "react";
import type { ButtonVariant } from "../../atoms/Button/Button.js";
import { FormAction } from "../../atoms/FormAction/FormAction.js";
import { IconCheck } from "../../atoms/Icons/Icons.js";
import { Card } from "../../molecules/Card/Card.js";
import type { CardImage } from "../../molecules/Card/Card.js";

/** Enlace de texto con destino (navegación de cabecera, pie…). */
export interface LandingLink {
  /** Texto del enlace, ya traducido. */
  label: string;
  /** Destino de navegación. */
  href: string;
}

/** Enlace con énfasis visual (acciones tipo botón que navegan). */
export interface LandingAction extends LandingLink {
  /** Énfasis visual; por defecto `primary` en hero/CTA final. */
  variant?: ButtonVariant;
}

/** Cabecera pública: marca, navegación simple y acciones de entrada. */
export interface LandingHeaderContent {
  /** Nombre del producto; enlaza a `brandHref`. */
  brandName: string;
  /** Destino de la marca (normalmente la propia landing). */
  brandHref: string;
  /** Nombre accesible de la navegación de cabecera. */
  navAriaLabel: string;
  /** Enlaces de la navegación (secciones de la landing o páginas públicas). */
  navLinks: LandingLink[];
  /** Acción de acceso (login), con énfasis `ghost`. */
  loginAction?: LandingLink;
  /** Acción principal de la cabecera (registro, demo…), énfasis `primary`. */
  ctaAction?: LandingLink;
}

/** Hero: titular, apoyo, CTAs e imagen opcional. */
export interface LandingHeroContent {
  /** Titular de la página — se renderiza como el único `h1`. */
  title: string;
  /** Subtítulo de apoyo bajo el titular. */
  subtitle?: string;
  /** CTA principal del hero. */
  primaryAction: LandingAction;
  /** CTA secundario del hero. */
  secondaryAction?: LandingAction;
  /** Imagen/ilustración lateral; sin ella el hero va a una columna. */
  image?: CardImage;
}

/** Característica del producto: icono decorativo, título y descripción. */
export interface LandingFeature {
  /** Clave estable del item. */
  id: string;
  /** Icono decorativo (los iconos del paquete ya son `aria-hidden`). */
  icon?: ReactNode;
  title: string;
  description: string;
}

/** Sección de características: rejilla de items con icono. */
export interface LandingFeaturesContent {
  /** Título de la sección (`h2`). */
  title: string;
  subtitle?: string;
  /** Entre 3 y 6 items recomendados. */
  items: LandingFeature[];
}

/** Módulo del producto: tarjeta con imagen (panel, sites, e-learning…). */
export interface LandingModule {
  /** Clave estable del item. */
  id: string;
  title: string;
  description: string;
  /** Imagen de cabecera de la tarjeta. */
  image?: CardImage;
  /** Si se pasa, la tarjeta entera es un enlace. */
  href?: string;
}

/** Sección de producto/módulos: rejilla de `Card` con imagen. */
export interface LandingModulesContent {
  /** Título de la sección (`h2`). */
  title: string;
  subtitle?: string;
  items: LandingModule[];
}

/** Plan de precios: nombre, precio ya formateado, features y CTA. */
export interface LandingPlan {
  /** Clave estable del plan. */
  id: string;
  name: string;
  /** Precio ya formateado con moneda (p. ej. "29 €"); la moneda la decide la app. */
  price: string;
  /** Periodicidad ya traducida (p. ej. "/mes"). */
  period?: string;
  /** Ventajas incluidas, una por línea. */
  features: string[];
  /** CTA del plan (enlace de contratación). */
  cta: LandingLink;
  /** Etiqueta de destaque (p. ej. "Recomendado"). */
  tag?: string;
}

/** Sección de precios: rejilla de planes. Opcional en la página. */
export interface LandingPricingContent {
  /** Título de la sección (`h2`). */
  title: string;
  subtitle?: string;
  /** Entre 2 y 3 planes recomendados. */
  plans: LandingPlan[];
}

/** CTA final antes del pie. */
export interface LandingFinalCtaContent {
  /** Título de la sección (`h2`). */
  title: string;
  subtitle?: string;
  actions: LandingAction[];
}

/** Pie: navegación secundaria y copyright. */
export interface LandingFooterContent {
  /** Nombre accesible de la navegación del pie. */
  navAriaLabel: string;
  links: LandingLink[];
  /** Línea de copyright ya traducida (p. ej. "© 2026 Langopia"). */
  copyright: string;
}

export interface LandingPageProps {
  header: LandingHeaderContent;
  hero: LandingHeroContent;
  features: LandingFeaturesContent;
  modules: LandingModulesContent;
  /** Sin `pricing` la sección de precios no se renderiza. */
  pricing?: LandingPricingContent;
  finalCta: LandingFinalCtaContent;
  footer: LandingFooterContent;
}

const pageStyles = "flex min-h-full w-full flex-col bg-canvas font-sans text-text";
const mainStyles = "flex w-full flex-1 flex-col";

// Cabecera pública.
const headerStyles = "w-full border-b border-border bg-surface";
const headerInnerStyles =
  "mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6";
const brandStyles =
  "rounded-md font-sans text-[length:var(--ink-text-lg)] leading-[var(--ink-leading-lg)] font-bold text-text no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const headerNavListStyles = "m-0 flex list-none flex-wrap items-center gap-4 p-0";
const navLinkStyles =
  "rounded-md font-sans text-[length:var(--ink-text-base)] leading-[var(--ink-leading-base)] text-muted no-underline transition-colors duration-fast hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const headerActionsStyles = "flex flex-wrap items-center gap-2";

// Secciones del cuerpo: ancho máximo común y ritmo vertical.
const sectionStyles = "mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16";
const sectionTitleStyles =
  "m-0 font-sans text-[length:var(--ink-text-2xl)] leading-[var(--ink-leading-2xl)] font-bold text-text";
const sectionSubtitleStyles =
  "m-0 mt-2 max-w-prose font-sans text-[length:var(--ink-text-lg)] leading-[var(--ink-leading-lg)] text-muted";

// Hero.
const heroGridStyles = "grid items-center gap-8 md:grid-cols-2";
const heroTitleStyles =
  "m-0 font-sans text-[length:var(--ink-text-3xl)] leading-[var(--ink-leading-3xl)] font-bold text-text";
const heroSubtitleStyles =
  "m-0 mt-3 max-w-prose font-sans text-[length:var(--ink-text-lg)] leading-[var(--ink-leading-lg)] text-muted";
const heroActionsStyles = "mt-6 flex flex-wrap items-center gap-3";
const heroImageStyles = "w-full rounded-lg border border-border object-cover shadow-[var(--ink-shadow-md)]";

// Características.
const featureGridStyles = "m-0 mt-8 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3";
const featureCardStyles =
  "flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 shadow-[var(--ink-shadow-sm)]";
const featureIconStyles = "inline-flex text-[1.5rem] leading-none text-accent";
const featureTitleStyles =
  "m-0 font-sans text-[length:var(--ink-text-md)] leading-[var(--ink-leading-md)] font-semibold text-text";
const featureDescriptionStyles =
  "m-0 font-sans text-[length:var(--ink-text-base)] leading-[var(--ink-leading-base)] text-muted";

// Módulos y precios comparten rejilla de tarjetas.
const cardGridStyles = "m-0 mt-8 grid list-none items-stretch gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3";
const moduleGridStyles = "m-0 mt-8 grid list-none items-stretch gap-4 p-0 sm:grid-cols-2";

// Plan de precios (contenido libre dentro de `Card`).
const planPriceStyles =
  "m-0 font-sans text-[length:var(--ink-text-2xl)] leading-[var(--ink-leading-2xl)] font-bold text-text";
const planPeriodStyles =
  "font-sans text-[length:var(--ink-text-base)] leading-[var(--ink-leading-base)] font-normal text-muted";
const planFeatureListStyles = "m-0 flex list-none flex-col gap-1 p-0";
const planFeatureStyles =
  "flex items-center gap-2 font-sans text-[length:var(--ink-text-base)] leading-[var(--ink-leading-base)] text-text";
const planFeatureIconStyles = "inline-flex shrink-0 text-[1em] leading-none text-success";

// CTA final.
const finalCtaStyles =
  "mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-4 py-12 text-center sm:px-6 sm:py-16";
const finalCtaActionsStyles = "mt-3 flex flex-wrap items-center justify-center gap-3";

// Pie.
const footerStyles = "w-full border-t border-border bg-surface";
const footerInnerStyles =
  "mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 sm:px-6";
const footerNavListStyles = "m-0 flex list-none flex-wrap items-center gap-4 p-0";
const copyrightStyles =
  "m-0 font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] text-muted";

/**
 * Landing pública del producto (marketing), compuesta por secciones
 * configurables. Todo el contenido llega por props agrupadas por sección
 * (`header`, `hero`, `features`, `modules`, `pricing`, `finalCta`, `footer`)
 * para que la app lo traduzca: no hay copy hardcodeado — incluso los
 * aria-labels de las navegaciones entran por props (`navAriaLabel`).
 *
 * Semántica: `header` con la navegación principal, `main` con el único `h1`
 * de la página en el hero, cada sección como `section` con `aria-labelledby`
 * apuntando a su `h2` (los items internos usan `h3`, vía `Card` o propio) y
 * `footer` con navegación secundaria y copyright. Los `aria-labelledby` se
 * generan con `useId`, así que no colisionan aunque hubiera dos landings.
 *
 * Todas las acciones son enlaces (`FormAction` con `href`): la página es
 * pública y presentacional; la navegación la resuelve la app. La sección de
 * precios es opcional (`pricing`); sin ella no se renderiza.
 */
export function LandingPage({
  header,
  hero,
  features,
  modules,
  pricing,
  finalCta,
  footer,
}: LandingPageProps): ReactElement {
  const baseId = useId();
  const heroTitleId = `${baseId}-hero`;
  const featuresTitleId = `${baseId}-features`;
  const modulesTitleId = `${baseId}-modules`;
  const pricingTitleId = `${baseId}-pricing`;
  const finalCtaTitleId = `${baseId}-final-cta`;

  return (
    <div className={pageStyles}>
      <header className={headerStyles}>
        <div className={headerInnerStyles}>
          <a href={header.brandHref} className={brandStyles}>
            {header.brandName}
          </a>
          <nav aria-label={header.navAriaLabel}>
            <ul className={headerNavListStyles}>
              {header.navLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className={navLinkStyles}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          {(header.loginAction !== undefined || header.ctaAction !== undefined) && (
            <div className={headerActionsStyles}>
              {header.loginAction !== undefined && (
                <FormAction href={header.loginAction.href} variant="ghost" size="sm">
                  {header.loginAction.label}
                </FormAction>
              )}
              {header.ctaAction !== undefined && (
                <FormAction href={header.ctaAction.href} variant="primary" size="sm">
                  {header.ctaAction.label}
                </FormAction>
              )}
            </div>
          )}
        </div>
      </header>

      <main className={mainStyles}>
        <section aria-labelledby={heroTitleId} className={sectionStyles}>
          <div className={hero.image !== undefined ? heroGridStyles : undefined}>
            <div>
              <h1 id={heroTitleId} className={heroTitleStyles}>
                {hero.title}
              </h1>
              {hero.subtitle !== undefined && <p className={heroSubtitleStyles}>{hero.subtitle}</p>}
              <div className={heroActionsStyles}>
                <FormAction
                  href={hero.primaryAction.href}
                  variant={hero.primaryAction.variant ?? "primary"}
                  size="lg"
                >
                  {hero.primaryAction.label}
                </FormAction>
                {hero.secondaryAction !== undefined && (
                  <FormAction
                    href={hero.secondaryAction.href}
                    variant={hero.secondaryAction.variant ?? "secondary"}
                    size="lg"
                  >
                    {hero.secondaryAction.label}
                  </FormAction>
                )}
              </div>
            </div>
            {hero.image !== undefined && (
              <img src={hero.image.src} alt={hero.image.alt} className={heroImageStyles} />
            )}
          </div>
        </section>

        <section aria-labelledby={featuresTitleId} className={sectionStyles}>
          <h2 id={featuresTitleId} className={sectionTitleStyles}>
            {features.title}
          </h2>
          {features.subtitle !== undefined && (
            <p className={sectionSubtitleStyles}>{features.subtitle}</p>
          )}
          <ul className={featureGridStyles}>
            {features.items.map((feature) => (
              <li key={feature.id} className={featureCardStyles}>
                {feature.icon !== undefined && (
                  <span className={featureIconStyles}>{feature.icon}</span>
                )}
                <h3 className={featureTitleStyles}>{feature.title}</h3>
                <p className={featureDescriptionStyles}>{feature.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby={modulesTitleId} className={sectionStyles}>
          <h2 id={modulesTitleId} className={sectionTitleStyles}>
            {modules.title}
          </h2>
          {modules.subtitle !== undefined && (
            <p className={sectionSubtitleStyles}>{modules.subtitle}</p>
          )}
          <ul className={moduleGridStyles}>
            {modules.items.map((module) => (
              <li key={module.id} className="flex">
                <Card title={module.title} image={module.image} href={module.href}>
                  {module.description}
                </Card>
              </li>
            ))}
          </ul>
        </section>

        {pricing !== undefined && (
          <section aria-labelledby={pricingTitleId} className={sectionStyles}>
            <h2 id={pricingTitleId} className={sectionTitleStyles}>
              {pricing.title}
            </h2>
            {pricing.subtitle !== undefined && (
              <p className={sectionSubtitleStyles}>{pricing.subtitle}</p>
            )}
            <ul className={cardGridStyles}>
              {pricing.plans.map((plan) => (
                <li key={plan.id} className="flex">
                  <Card
                    title={plan.name}
                    tags={plan.tag !== undefined ? [{ label: plan.tag, variant: "accent" }] : undefined}
                    actions={[{ label: plan.cta.label, href: plan.cta.href, variant: "primary" }]}
                  >
                    <p className={planPriceStyles}>
                      {plan.price}
                      {plan.period !== undefined && (
                        <span className={planPeriodStyles}> {plan.period}</span>
                      )}
                    </p>
                    <ul className={planFeatureListStyles}>
                      {plan.features.map((feature) => (
                        <li key={feature} className={planFeatureStyles}>
                          <IconCheck className={planFeatureIconStyles} />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby={finalCtaTitleId} className={finalCtaStyles}>
          <h2 id={finalCtaTitleId} className={sectionTitleStyles}>
            {finalCta.title}
          </h2>
          {finalCta.subtitle !== undefined && (
            <p className={sectionSubtitleStyles}>{finalCta.subtitle}</p>
          )}
          <div className={finalCtaActionsStyles}>
            {finalCta.actions.map((action) => (
              <FormAction
                key={action.href}
                href={action.href}
                variant={action.variant ?? "primary"}
                size="lg"
              >
                {action.label}
              </FormAction>
            ))}
          </div>
        </section>
      </main>

      <footer className={footerStyles}>
        <div className={footerInnerStyles}>
          <nav aria-label={footer.navAriaLabel}>
            <ul className={footerNavListStyles}>
              {footer.links.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className={navLinkStyles}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <p className={copyrightStyles}>{footer.copyright}</p>
        </div>
      </footer>
    </div>
  );
}
