import type { ReactElement, ReactNode } from "react";
import { FormAction } from "../../atoms/FormAction/FormAction.js";
import type { ButtonVariant } from "../../atoms/Button/Button.js";
import { IconCheckCircle } from "../../atoms/Icons/Icons.js";
import type { CheckoutItem } from "../CheckoutPage/CheckoutPage.js";

/** Acción de salida de la confirmación (volver al panel, ver factura…). */
export interface CheckoutSuccessAction {
  /** Texto de la acción, ya traducido. */
  label: string;
  /** Destino de navegación. */
  href: string;
  /** Énfasis visual; por defecto `secondary` (el primario lo decide quien llama). */
  variant?: ButtonVariant;
}

export interface CheckoutSuccessProps {
  /** Título de la confirmación (p. ej. "Pago completado"). */
  title: string;
  /** Mensaje de apoyo bajo el título. */
  message?: ReactNode;
  /** Referencia del pedido; se muestra con `orderReferenceLabel`. */
  orderReference?: string;
  /** Etiqueta de la referencia (p. ej. "Referencia del pedido"). */
  orderReferenceLabel?: string;
  /** Resumen opcional del pedido (mismas líneas que `CheckoutPage`). */
  items?: CheckoutItem[];
  /** Total ya formateado; requiere `totalLabel`. */
  total?: string;
  /** Etiqueta de la fila de total. */
  totalLabel?: string;
  /** Acciones de salida, en orden. */
  actions: CheckoutSuccessAction[];
}

const wrapperStyles = "flex w-full flex-col items-center gap-4 py-12 text-center";
const iconStyles = "text-[3rem] leading-none text-success";
const titleStyles =
  "m-0 font-sans text-[length:var(--ink-text-2xl)] leading-[var(--ink-leading-2xl)] font-bold text-text";
const messageStyles =
  "m-0 max-w-prose font-sans text-[length:var(--ink-text-base)] leading-[var(--ink-leading-base)] text-muted";
const referenceStyles =
  "m-0 font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] text-muted";
const summaryStyles =
  "flex w-full max-w-md flex-col gap-1 rounded-lg border border-border bg-surface p-4 text-left";
const itemRowStyles =
  "flex items-baseline justify-between gap-3 font-sans text-[length:var(--ink-text-base)] leading-[var(--ink-leading-base)] text-text";
const itemNameStyles = "min-w-0 truncate";
const quantityStyles = "text-muted";
const priceStyles = "shrink-0 font-medium";
const itemListStyles = "m-0 flex list-none flex-col gap-1 p-0";
const totalRowStyles =
  "mt-2 flex items-baseline justify-between gap-3 border-t border-border pt-2 font-sans text-[length:var(--ink-text-md)] leading-[var(--ink-leading-md)] font-semibold text-text";
const actionsStyles = "flex flex-wrap items-center justify-center gap-2";

/**
 * Página de confirmación de pago: icono de éxito, título y mensaje por props,
 * referencia del pedido, resumen opcional y acciones de salida (enlaces por
 * `href`). Centrada y presentacional — la navegación la resuelve la app.
 */
export function CheckoutSuccess({
  title,
  message,
  orderReference,
  orderReferenceLabel,
  items,
  total,
  totalLabel,
  actions,
}: CheckoutSuccessProps): ReactElement {
  return (
    <div className={wrapperStyles}>
      <IconCheckCircle className={iconStyles} />
      <h1 className={titleStyles}>{title}</h1>
      {message && <p className={messageStyles}>{message}</p>}
      {orderReference !== undefined && orderReferenceLabel !== undefined && (
        <p className={referenceStyles}>
          {orderReferenceLabel}: <strong className="text-text">{orderReference}</strong>
        </p>
      )}
      {items !== undefined && items.length > 0 && (
        <div className={summaryStyles}>
          <ul className={itemListStyles}>
            {items.map((item) => (
              <li key={item.id} className={itemRowStyles}>
                <span className={itemNameStyles}>
                  {item.name} <span className={quantityStyles}>× {item.quantity}</span>
                </span>
                <span className={priceStyles}>{item.price}</span>
              </li>
            ))}
          </ul>
          {total !== undefined && totalLabel !== undefined && (
            <div className={totalRowStyles}>
              <span>{totalLabel}</span>
              <span>{total}</span>
            </div>
          )}
        </div>
      )}
      <div className={actionsStyles}>
        {actions.map((action) => (
          <FormAction key={action.label} href={action.href} variant={action.variant ?? "secondary"}>
            {action.label}
          </FormAction>
        ))}
      </div>
    </div>
  );
}
