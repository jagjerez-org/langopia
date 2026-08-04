import { useState } from "react";
import type { ChangeEvent, ReactElement } from "react";
import type { ChipVariant } from "../../atoms/Chip/Chip.js";
import { Selector } from "../../atoms/Selector/Selector.js";
import { ActionBar } from "../../molecules/ActionBar/ActionBar.js";
import { CrudForm } from "../../molecules/CrudForm/CrudForm.js";
import type { CrudField, CrudFormValues } from "../../molecules/CrudForm/CrudForm.js";
import { List } from "../../molecules/List/List.js";
import type { ListItem } from "../../molecules/List/List.js";
import { Section } from "../../molecules/Section/Section.js";

export type ProfessorStatus = "active" | "inactive";

export interface Professor {
  /** Clave estable del profesor. */
  id: string;
  name: string;
  email?: string;
  /** Especialidad o asignatura que imparte (texto ya resuelto). */
  specialty: string;
  /** URL del avatar, ya resuelta por quien llama. */
  avatarUrl?: string;
  status: ProfessorStatus;
}

/** Acción del menú de cada fila (ver, editar, dar de baja…). */
export interface ProfessorAction {
  id: string;
  /** Texto de la acción (ya traducido). */
  label: string;
}

export interface ProfessorsPageLabels {
  /** Título de la página. */
  title: string;
  /** Título visible sobre la lista de profesorado. */
  listTitle: string;
  /** Nombre accesible de la región de la lista. */
  listLabel: string;
  /** Etiqueta del buscador de la lista. */
  searchLabel: string;
  searchPlaceholder?: string;
  /** Etiqueta del selector de ordenación. */
  sortLabel: string;
  /** Opción de ordenar por nombre. */
  sortByNameLabel: string;
  /** Opción de ordenar por especialidad. */
  sortBySpecialtyLabel: string;
  /** Etiqueta del selector de filtro por estado. */
  filterLabel: string;
  /** Opción del filtro que muestra todos los estados. */
  allStatusesLabel: string;
  /** Texto de cada estado en los chips y en el filtro. */
  statusLabels: Record<ProfessorStatus, string>;
  /** Estado vacío de la lista (sin profesorado o sin resultados). */
  emptyLabel: string;
  previousLabel: string;
  nextLabel: string;
  /** Botón que muestra el formulario de alta. */
  addProfessorLabel: string;
  /** Título de la sección con el formulario de alta. */
  addProfessorTitle: string;
  /** Botón de enviar el formulario de alta. */
  submitProfessorLabel: string;
  cancelLabel: string;
}

export interface ProfessorsPageProps {
  professors: Professor[];
  /** Campos del formulario de alta (misma descripción que `CrudForm`). */
  createFields: CrudField[];
  /** Acciones del menú de cada fila; sin ellas no hay menú. */
  actions?: ProfessorAction[];
  /** Textos de la interfaz, ya traducidos. */
  labels: ProfessorsPageLabels;
  /** Tamaño de página de la lista; sin paginación si no se pasa. */
  pageSize?: number;
  /** Recibe los valores validados del formulario de alta. */
  onAddProfessor: (values: CrudFormValues) => void;
  /** Notifica la acción elegida con el id del profesor y el de la acción. */
  onProfessorAction?: (professorId: string, actionId: string) => void;
}

/** Cada estado usa una variante semántica del Chip: nunca solo color libre. */
const STATUS_VARIANT: Record<ProfessorStatus, ChipVariant> = {
  active: "success",
  inactive: "neutral",
};

const ALL_STATUSES = "all";

const wrapperStyles = "flex w-full flex-col gap-4";
const headerStyles = "flex flex-wrap items-end justify-between gap-3";
const titleStyles =
  "m-0 font-sans text-[length:var(--ink-text-xl)] leading-[var(--ink-leading-xl)] font-bold text-text";
const filterStyles = "w-56";

/**
 * Página de gestión del profesorado: una `List` con avatar, especialidad y
 * estado (`Chip`) de cada profesor —la búsqueda, la ordenación y la
 * paginación las resuelve la propia `List`—, un filtro por estado
 * (`Selector`, filtrado interno) y un alta con `CrudForm` inline que se
 * despliega desde la barra de acciones. Sin API: todo llega por props y se
 * notifica por callbacks.
 */
export function ProfessorsPage({
  professors,
  createFields,
  actions,
  labels,
  pageSize,
  onAddProfessor,
  onProfessorAction,
}: ProfessorsPageProps): ReactElement {
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUSES);
  const [isCreating, setIsCreating] = useState(false);

  const changeFilter = (event: ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(event.target.value);
  };

  const visible =
    statusFilter === ALL_STATUSES
      ? professors
      : professors.filter((professor) => professor.status === statusFilter);

  const items: ListItem[] = visible.map((professor) => ({
    id: professor.id,
    title: professor.name,
    subtitle: [professor.specialty, professor.email].filter(Boolean).join(" · "),
    tags: [
      {
        label: labels.statusLabels[professor.status],
        variant: STATUS_VARIANT[professor.status],
      },
    ],
    avatar: { name: professor.name, src: professor.avatarUrl },
    actions:
      actions !== undefined && onProfessorAction !== undefined
        ? actions.map((action) => ({
            label: action.label,
            onClick: () => onProfessorAction(professor.id, action.id),
          }))
        : undefined,
  }));

  const addProfessor = (values: CrudFormValues) => {
    onAddProfessor(values);
    setIsCreating(false);
  };

  return (
    <div className={wrapperStyles}>
      <div className={headerStyles}>
        <h1 className={titleStyles}>{labels.title}</h1>
        <div className={filterStyles}>
          <Selector
            label={labels.filterLabel}
            options={[
              { value: ALL_STATUSES, label: labels.allStatusesLabel },
              ...(["active", "inactive"] as const).map((status) => ({
                value: status,
                label: labels.statusLabels[status],
              })),
            ]}
            value={statusFilter}
            onChange={changeFilter}
          />
        </div>
      </div>
      <ActionBar
        actions={[
          {
            label: labels.addProfessorLabel,
            variant: "primary",
            onClick: () => setIsCreating(true),
          },
        ]}
      />
      {isCreating && (
        <Section title={labels.addProfessorTitle}>
          <CrudForm
            fields={createFields}
            onSubmit={addProfessor}
            onCancel={() => setIsCreating(false)}
            submitLabel={labels.submitProfessorLabel}
            cancelLabel={labels.cancelLabel}
          />
        </Section>
      )}
      <List
        items={items}
        ariaLabel={labels.listLabel}
        title={labels.listTitle}
        searchLabel={labels.searchLabel}
        searchPlaceholder={labels.searchPlaceholder}
        sortLabel={labels.sortLabel}
        sortOptions={[
          { value: "title", label: labels.sortByNameLabel },
          { value: "subtitle", label: labels.sortBySpecialtyLabel },
        ]}
        pageSize={pageSize}
        previousLabel={labels.previousLabel}
        nextLabel={labels.nextLabel}
        emptyLabel={labels.emptyLabel}
      />
    </div>
  );
}
