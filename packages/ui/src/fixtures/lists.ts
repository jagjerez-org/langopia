import type { ListItem, ListSortOption } from "../molecules/List/List.js";
import type { ListRowAction, ListRowProps } from "../molecules/ListRow/ListRow.js";

/**
 * Datos ficticios neutros para stories y specs de `List` y `ListRow`.
 * Sin datos del dominio de Langopia: documentos y personas de relleno.
 */

export const rowActions: ListRowAction[] = [
  { label: "Ver detalle" },
  { label: "Duplicar" },
  { label: "Eliminar" },
];

export const listItems: ListItem[] = [
  {
    id: "doc-1",
    title: "Informe anual 2025",
    subtitle: "Actualizado hace 2 días",
    tags: [{ label: "Revisión", variant: "warning" }],
    avatar: { name: "Ana Torres" },
    actions: rowActions,
  },
  {
    id: "doc-2",
    title: "Propuesta de presupuesto",
    subtitle: "Actualizado hace 5 días",
    tags: [{ label: "Borrador", variant: "neutral" }],
    avatar: { name: "Luis Martín" },
  },
  {
    id: "doc-3",
    title: "Acta de la reunión de junio",
    subtitle: "Actualizado hace 1 semana",
    tags: [{ label: "Aprobado", variant: "success" }],
    actions: rowActions,
  },
  {
    id: "doc-4",
    title: "Guía de estilo editorial",
    subtitle: "Actualizado hace 2 semanas",
    tags: [{ label: "Publicado", variant: "accent" }],
    avatar: { name: "Carmen Ruiz" },
  },
  {
    id: "doc-5",
    title: "Plan de contingencia",
    subtitle: "Actualizado hace 3 semanas",
    tags: [{ label: "Obsoleto", variant: "critical" }],
  },
  {
    id: "doc-6",
    title: "Inventario de material",
    subtitle: "Actualizado hace 1 mes",
    avatar: { name: "Diego Sanz" },
    actions: rowActions,
  },
  {
    id: "doc-7",
    title: "Contrato de arrendamiento",
    subtitle: "Actualizado hace 2 meses",
    tags: [{ label: "Firmado", variant: "success" }],
  },
  {
    id: "doc-8",
    title: "Manual de incorporación",
    subtitle: "Actualizado hace 3 meses",
    tags: [{ label: "Publicado", variant: "accent" }],
    avatar: { name: "Elena Gil" },
  },
];

export const listSortOptions: ListSortOption[] = [
  { value: "title", label: "Título" },
  { value: "subtitle", label: "Fecha" },
];

/** Props base de una fila suelta para stories y specs de `ListRow`. */
export const listRowBase: ListRowProps = {
  title: "Informe anual 2025",
  subtitle: "Actualizado hace 2 días",
  tags: [
    { label: "Revisión", variant: "warning" },
    { label: "Prioritario", variant: "critical" },
  ],
  avatar: { name: "Ana Torres" },
  actions: rowActions,
  actionsLabel: "Acciones de Informe anual 2025",
};
