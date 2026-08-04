import { useRef, useState } from "react";
import type { FormEvent, ReactElement, ReactNode } from "react";
import { Input } from "../../atoms/Input/Input.js";
import { Selector } from "../../atoms/Selector/Selector.js";
import { Textarea } from "../../atoms/Textarea/Textarea.js";
import { ActionBar } from "../../molecules/ActionBar/ActionBar.js";
import type { CrudField } from "../../molecules/CrudForm/CrudForm.js";
import { Section } from "../../molecules/Section/Section.js";

/** Línea del pedido: nombre, cantidad y precio ya formateado con moneda. */
export interface CheckoutItem {
  /** Clave estable de la línea. */
  id: string;
  name: string;
  quantity: number;
  /** Precio de la línea ya formateado (p. ej. "29,00 €"). */
  price: string;
}

export interface CheckoutPageLabels {
  /** Título de la página. */
  title: string;
  /** Título de la sección de resumen del pedido. */
  summaryTitle: string;
  /** Etiqueta de la fila de total. */
  totalLabel: string;
  /** Título de la sección de pago. */
  paymentTitle: string;
  /** Texto de la sección de pago cuando no hay `paymentSlot`. */
  paymentFallback: string;
  /** Título de la sección de datos de facturación. */
  billingTitle: string;
  /** Botón de confirmar el pago. */
  submitLabel: string;
  /** Botón de cancelar. */
  cancelLabel: string;
  /** Anuncio de progreso mientras se procesa (role="status"). */
  processingLabel: string;
}

/** Valores de facturación que recibe `onSubmit` (nunca datos de tarjeta). */
export type CheckoutBillingValues = Record<string, string>;

export interface CheckoutPageProps {
  /** Líneas del pedido. */
  items: CheckoutItem[];
  /** Total ya formateado con moneda (p. ej. "58,00 €"). */
  total: string;
  /**
   * Campos de facturación (misma descripción que `CrudForm`; se renderizan
   * como átomos controlados sin validación de esquema — la validación y el
   * envío real los hace la app al conectar el pago).
   */
  billingFields: CrudField[];
  /**
   * Valores iniciales de facturación por nombre de campo. Solo se leen en el
   * montaje: el estado es interno y no controlado.
   */
  billingDefaultValues?: CheckoutBillingValues;
  /**
   * Slot para el método de pago: aquí la app monta Stripe Elements u otro
   * proveedor. El paquete no integra ni conoce Stripe; los datos sensibles
   * nunca pasan por este componente.
   */
  paymentSlot?: ReactNode;
  /** Textos de la interfaz, ya traducidos. */
  labels: CheckoutPageLabels;
  /** Pago en curso: deshabilita campos y acciones y anuncia el progreso. */
  isProcessing?: boolean;
  /** Error de pago ya traducido, con role="alert". */
  error?: ReactNode;
  /** Recibe los datos de facturación (no sensibles) al confirmar. */
  onSubmit: (values: CheckoutBillingValues) => void | Promise<void>;
  /** Si se pasa, aparece la acción de cancelar. */
  onCancel?: () => void;
}

const wrapperStyles = "mx-auto flex w-full max-w-3xl flex-col gap-4";
const titleStyles =
  "m-0 font-sans text-[length:var(--ink-text-xl)] leading-[var(--ink-leading-xl)] font-bold text-text";
const errorStyles =
  "m-0 rounded-md border border-critical bg-critical-bg px-3 py-2 text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] font-medium text-critical";
const statusStyles =
  "m-0 font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] text-muted";
const itemListStyles = "m-0 flex list-none flex-col gap-1 p-0";
const itemRowStyles =
  "flex items-baseline justify-between gap-3 font-sans text-[length:var(--ink-text-base)] leading-[var(--ink-leading-base)] text-text";
const itemNameStyles = "min-w-0 truncate";
const quantityStyles = "text-muted";
const priceStyles = "shrink-0 font-medium";
const totalRowStyles =
  "mt-2 flex items-baseline justify-between gap-3 border-t border-border pt-2 font-sans text-[length:var(--ink-text-md)] leading-[var(--ink-leading-md)] font-semibold text-text";
const fallbackStyles =
  "m-0 font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] text-muted";
const billingGridStyles = "grid grid-cols-1 gap-3 sm:grid-cols-2";

/**
 * Página de checkout: resumen del pedido, método de pago (slot `paymentSlot`
 * para que la app monte el proveedor — sin integración Stripe en el paquete),
 * datos de facturación y barra de acciones con confirmar/cancelar.
 *
 * Todo va dentro de un `<form noValidate>`: confirmar es un botón submit y
 * Enter desde un campo también envía. Se usa `noValidate` a propósito (patrón
 * de las moléculas de formulario del paquete): la validación de verdad la
 * hace la app al conectar el pago — `required` es solo indicación visual.
 *
 * `onSubmit` recibe solo los datos de facturación (no sensibles). Los estados
 * `isProcessing` y `error` se controlan por props.
 *
 * Además del `isProcessing` externo, hay una guardia interna contra doble
 * envío: la prop llega un render tarde, así que dos submits en el mismo tick
 * (doble clic rápido, Enter + clic) llamarían dos veces a `onSubmit`. La
 * guardia se activa al empezar el submit y se libera cuando la promesa
 * devuelta se resuelve o rechaza; si `onSubmit` es síncrono se libera en el
 * siguiente microtask, suficiente para bloquear el doble disparo del mismo
 * gesto sin impedir un nuevo envío posterior.
 */
export function CheckoutPage({
  items,
  total,
  billingFields,
  billingDefaultValues,
  paymentSlot,
  labels,
  isProcessing = false,
  error,
  onSubmit,
  onCancel,
}: CheckoutPageProps): ReactElement {
  const [billingValues, setBillingValues] = useState<CheckoutBillingValues>(() => {
    const values: CheckoutBillingValues = {};
    for (const field of billingFields) {
      const initial = billingDefaultValues?.[field.name];
      values[field.name] = initial !== undefined ? String(initial) : "";
    }
    return values;
  });

  const setBillingValue = (name: string, value: string) => {
    setBillingValues((current) => ({ ...current, [name]: value }));
  };

  // Guardia contra doble submit: `isProcessing` llega una render tarde, así
  // que no basta para bloquear dos submits en el mismo tick.
  const submitInFlightRef = useRef(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isProcessing || submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    const release = () => {
      submitInFlightRef.current = false;
    };
    try {
      const result = onSubmit(billingValues);
      if (result instanceof Promise) {
        void result.then(release, release);
      } else {
        // Callback síncrono: se libera en el siguiente microtask para que dos
        // submits del mismo gesto no llamen dos veces a `onSubmit`.
        queueMicrotask(release);
      }
    } catch (error) {
      release();
      throw error;
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit} className={wrapperStyles}>
      <h1 className={titleStyles}>{labels.title}</h1>
      {error && (
        <p role="alert" className={errorStyles}>
          {error}
        </p>
      )}
      <Section title={labels.summaryTitle}>
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
        <div className={totalRowStyles}>
          <span>{labels.totalLabel}</span>
          <span>{total}</span>
        </div>
      </Section>
      <Section title={labels.paymentTitle}>
        {paymentSlot ?? <p className={fallbackStyles}>{labels.paymentFallback}</p>}
      </Section>
      <Section title={labels.billingTitle}>
        <div className={billingGridStyles}>
          {billingFields.map((field) => {
            const value = billingValues[field.name] ?? "";
            if (field.type === "textarea") {
              return (
                <Textarea
                  key={field.name}
                  label={field.label}
                  placeholder={field.placeholder}
                  required={field.required}
                  disabled={isProcessing}
                  value={value}
                  onChange={(event) => setBillingValue(field.name, event.target.value)}
                />
              );
            }
            if (field.type === "select") {
              return (
                <Selector
                  key={field.name}
                  label={field.label}
                  placeholder={field.placeholder}
                  options={field.options ?? []}
                  required={field.required}
                  disabled={isProcessing}
                  value={value}
                  onChange={(event) => setBillingValue(field.name, event.target.value)}
                />
              );
            }
            return (
              <Input
                key={field.name}
                label={field.label}
                placeholder={field.placeholder}
                type={field.type === "email" || field.type === "number" || field.type === "date" ? field.type : "text"}
                required={field.required}
                disabled={isProcessing}
                value={value}
                onChange={(event) => setBillingValue(field.name, event.target.value)}
              />
            );
          })}
        </div>
      </Section>
      {isProcessing && (
        <p role="status" className={statusStyles}>
          {labels.processingLabel}
        </p>
      )}
      <ActionBar
        actions={[
          ...(onCancel !== undefined
            ? [
                {
                  label: labels.cancelLabel,
                  variant: "secondary" as const,
                  disabled: isProcessing,
                  onClick: onCancel,
                },
              ]
            : []),
          {
            label: labels.submitLabel,
            variant: "primary" as const,
            type: "submit" as const,
            isLoading: isProcessing,
          },
        ]}
      />
    </form>
  );
}
