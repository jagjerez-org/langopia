import { useState } from "react";
import type { ChangeEvent, ReactElement } from "react";
import type { ChipVariant } from "../../atoms/Chip/Chip.js";
import { Selector } from "../../atoms/Selector/Selector.js";
import { KpiChart } from "../../molecules/KpiChart/KpiChart.js";
import type { KpiChartProps } from "../../molecules/KpiChart/KpiChart.js";
import { List } from "../../molecules/List/List.js";
import type { ListItem } from "../../molecules/List/List.js";

export type PaymentStatus = "paid" | "pending" | "overdue";

export interface PaymentRecord {
  /** Clave estable del pago. */
  id: string;
  /** Concepto visible de la fila (p. ej. número de factura y curso). */
  concept: string;
  /** Meta bajo el concepto (cliente, fecha…). */
  detail?: string;
  /** Importe ya formateado con moneda (p. ej. "120,00 €"). */
  amount: string;
  status: PaymentStatus;
}

/** Acción del menú de cada fila (ver, descargar, reembolsar…). */
export interface PaymentAction {
  id: string;
  /** Texto de la acción (ya traducido). */
  label: string;
}

export interface PaymentsPageLabels {
  /** Título de la página. */
  title: string;
  /** Título visible sobre la lista de pagos. */
  listTitle: string;
  /** Nombre accesible de la región de la lista. */
  listLabel: string;
  /** Etiqueta del selector de filtro por estado. */
  filterLabel: string;
  /** Opción del filtro que muestra todos los pagos. */
  allStatusesLabel: string;
  /** Texto de cada estado en los chips y en el filtro. */
  statusLabels: Record<PaymentStatus, string>;
  /** Estado vacío de la lista (sin pagos o sin resultados del filtro). */
  emptyLabel: string;
  previousLabel: string;
  nextLabel: string;
}

export interface PaymentsPageProps {
  /** KPIs de resumen (cobrado, pendiente…), tal cual para `KpiChart`. */
  summary: KpiChartProps[];
  payments: PaymentRecord[];
  /** Acciones del menú de cada fila. */
  actions: PaymentAction[];
  /** Textos de la interfaz, ya traducidos. */
  labels: PaymentsPageLabels;
  /** Tamaño de página de la lista; sin paginación si no se pasa. */
  pageSize?: number;
  /** Notifica la acción elegida con el id del pago y el de la acción. */
  onAction: (paymentId: string, actionId: string) => void;
}

/** Cada estado usa una variante semántica del Chip: nunca solo color libre. */
const STATUS_VARIANT: Record<PaymentStatus, ChipVariant> = {
  paid: "success",
  pending: "warning",
  overdue: "critical",
};

const ALL_STATUSES = "all";

const wrapperStyles = "flex w-full flex-col gap-4";
const headerStyles = "flex flex-wrap items-end justify-between gap-3";
const titleStyles =
  "m-0 font-sans text-[length:var(--ink-text-xl)] leading-[var(--ink-leading-xl)] font-bold text-text";
const filterStyles = "w-56";
const gridStyles = "m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2";

/**
 * Página de pagos y facturas: KPIs de resumen arriba y debajo una `List`
 * con el estado de cada pago como `Chip`, un filtro por estado (`Selector`,
 * filtrado interno) y las acciones de cada fila en su menú contextual.
 * La paginación la resuelve la propia `List` con `pageSize`.
 */
export function PaymentsPage({
  summary,
  payments,
  actions,
  labels,
  pageSize,
  onAction,
}: PaymentsPageProps): ReactElement {
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUSES);

  const changeFilter = (event: ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(event.target.value);
  };

  const visible =
    statusFilter === ALL_STATUSES
      ? payments
      : payments.filter((payment) => payment.status === statusFilter);

  const items: ListItem[] = visible.map((payment) => ({
    id: payment.id,
    title: payment.concept,
    subtitle: [payment.detail, payment.amount].filter(Boolean).join(" · "),
    tags: [
      {
        label: labels.statusLabels[payment.status],
        variant: STATUS_VARIANT[payment.status],
      },
    ],
    actions: actions.map((action) => ({
      label: action.label,
      onClick: () => onAction(payment.id, action.id),
    })),
  }));

  return (
    <div className={wrapperStyles}>
      <div className={headerStyles}>
        <h1 className={titleStyles}>{labels.title}</h1>
        <div className={filterStyles}>
          <Selector
            label={labels.filterLabel}
            options={[
              { value: ALL_STATUSES, label: labels.allStatusesLabel },
              ...(["paid", "pending", "overdue"] as const).map((status) => ({
                value: status,
                label: labels.statusLabels[status],
              })),
            ]}
            value={statusFilter}
            onChange={changeFilter}
          />
        </div>
      </div>
      <ul className={gridStyles}>
        {summary.map((kpi) => (
          <li key={kpi.title}>
            <KpiChart {...kpi} />
          </li>
        ))}
      </ul>
      <List
        items={items}
        ariaLabel={labels.listLabel}
        title={labels.listTitle}
        pageSize={pageSize}
        previousLabel={labels.previousLabel}
        nextLabel={labels.nextLabel}
        emptyLabel={labels.emptyLabel}
      />
    </div>
  );
}
