import { useState } from "react";
import type { ChangeEvent, ReactElement } from "react";
import { Chip } from "../../atoms/Chip/Chip.js";
import type { ChipVariant } from "../../atoms/Chip/Chip.js";
import { Button } from "../../atoms/Button/Button.js";
import { Selector } from "../../atoms/Selector/Selector.js";
import { ActionBar } from "../../molecules/ActionBar/ActionBar.js";
import { CrudForm } from "../../molecules/CrudForm/CrudForm.js";
import type { CrudField, CrudFormValues } from "../../molecules/CrudForm/CrudForm.js";
import { List } from "../../molecules/List/List.js";
import type { ListItem } from "../../molecules/List/List.js";
import { Section } from "../../molecules/Section/Section.js";
import { UserComponent } from "../../molecules/UserComponent/UserComponent.js";

export type StudentStatus = "active" | "inactive";

export interface Student {
  /** Clave estable del estudiante. */
  id: string;
  name: string;
  email: string;
  /** URL del avatar, ya resuelta por quien llama. */
  avatarUrl?: string;
  /** Curso o grupo al que pertenece (texto ya resuelto). */
  group?: string;
  status: StudentStatus;
}

/** Acción del menú de cada fila (ver, editar, dar de baja…). */
export interface StudentAction {
  id: string;
  /** Texto de la acción (ya traducido). */
  label: string;
}

export interface StudentPageLabels {
  /** Título de la página. */
  title: string;
  /** Título visible sobre la lista de estudiantes. */
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
  /** Opción de ordenar por correo electrónico. */
  sortByEmailLabel: string;
  /** Etiqueta del selector de filtro por estado. */
  filterLabel: string;
  /** Opción del filtro que muestra todos los estados. */
  allStatusesLabel: string;
  /** Texto de cada estado en los chips y en el filtro. */
  statusLabels: Record<StudentStatus, string>;
  /** Estado vacío de la lista (sin estudiantes o sin resultados). */
  emptyLabel: string;
  previousLabel: string;
  nextLabel: string;
  /** Botón que muestra el formulario de alta. */
  addStudentLabel: string;
  /** Título de la sección con el formulario de alta. */
  addStudentTitle: string;
  /** Botón de enviar el formulario de alta. */
  submitStudentLabel: string;
  cancelLabel: string;
  /** Nombre accesible del panel lateral con la ficha del estudiante. */
  detailLabel: string;
  /** Término del dato "grupo" en la ficha. */
  detailGroupLabel: string;
  /** Término del dato "estado" en la ficha. */
  detailStatusLabel: string;
  /** Botón que cierra la ficha del estudiante. */
  closeDetailLabel: string;
}

export interface StudentPageProps {
  students: Student[];
  /** Campos del formulario de alta (misma descripción que `CrudForm`). */
  createFields: CrudField[];
  /** Acciones del menú de cada fila; sin ellas no hay menú. */
  actions?: StudentAction[];
  /** Textos de la interfaz, ya traducidos. */
  labels: StudentPageLabels;
  /** Tamaño de página de la lista; sin paginación si no se pasa. */
  pageSize?: number;
  /** Recibe los valores validados del formulario de alta. */
  onAddStudent: (values: CrudFormValues) => void;
  /** Notifica la acción elegida con el id del estudiante y el de la acción. */
  onStudentAction?: (studentId: string, actionId: string) => void;
}

/** Cada estado usa una variante semántica del Chip: nunca solo color libre. */
const STATUS_VARIANT: Record<StudentStatus, ChipVariant> = {
  active: "success",
  inactive: "neutral",
};

const ALL_STATUSES = "all";

const wrapperStyles = "flex w-full flex-col gap-4";
const headerStyles = "flex flex-wrap items-end justify-between gap-3";
const titleStyles =
  "m-0 font-sans text-[length:var(--ink-text-xl)] leading-[var(--ink-leading-xl)] font-bold text-text";
const filterStyles = "w-56";
const columnsStyles = "grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_20rem]";
const detailStyles = "flex flex-col gap-3 rounded-lg border border-border bg-surface p-4";
const detailRowsStyles = "m-0 flex flex-col gap-2";
const detailRowStyles = "flex items-center justify-between gap-2";
const detailTermStyles =
  "m-0 font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] text-muted";
const detailValueStyles =
  "m-0 font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] font-medium text-text";
const detailCloseStyles = "flex justify-end";

/**
 * Página de gestión de estudiantes: una `List` con avatar, correo, grupo y
 * estado (`Chip`) de cada estudiante —la búsqueda, la ordenación y la
 * paginación las resuelve la propia `List`—, un filtro por estado
 * (`Selector`, filtrado interno) y un alta con `CrudForm` inline que se
 * despliega desde la barra de acciones. Al pulsar una fila se abre un panel
 * lateral con la ficha (`UserComponent` + datos). Sin API: todo llega por
 * props y se notifica por callbacks.
 */
export function StudentPage({
  students,
  createFields,
  actions,
  labels,
  pageSize,
  onAddStudent,
  onStudentAction,
}: StudentPageProps): ReactElement {
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUSES);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const changeFilter = (event: ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(event.target.value);
  };

  const visible =
    statusFilter === ALL_STATUSES
      ? students
      : students.filter((student) => student.status === statusFilter);

  const selected = students.find((student) => student.id === selectedId) ?? null;

  const items: ListItem[] = visible.map((student) => ({
    id: student.id,
    title: student.name,
    subtitle: [student.email, student.group].filter(Boolean).join(" · "),
    tags: [
      {
        label: labels.statusLabels[student.status],
        variant: STATUS_VARIANT[student.status],
      },
    ],
    avatar: { name: student.name, src: student.avatarUrl },
    actions:
      actions !== undefined && onStudentAction !== undefined
        ? actions.map((action) => ({
            label: action.label,
            onClick: () => onStudentAction(student.id, action.id),
          }))
        : undefined,
    onClick: () => setSelectedId(student.id),
  }));

  const addStudent = (values: CrudFormValues) => {
    onAddStudent(values);
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
            label: labels.addStudentLabel,
            variant: "primary",
            onClick: () => setIsCreating(true),
          },
        ]}
      />
      {isCreating && (
        <Section title={labels.addStudentTitle}>
          <CrudForm
            fields={createFields}
            onSubmit={addStudent}
            onCancel={() => setIsCreating(false)}
            submitLabel={labels.submitStudentLabel}
            cancelLabel={labels.cancelLabel}
          />
        </Section>
      )}
      <div className={selected !== null ? columnsStyles : undefined}>
        <List
          items={items}
          ariaLabel={labels.listLabel}
          title={labels.listTitle}
          searchLabel={labels.searchLabel}
          searchPlaceholder={labels.searchPlaceholder}
          sortLabel={labels.sortLabel}
          sortOptions={[
            { value: "title", label: labels.sortByNameLabel },
            { value: "subtitle", label: labels.sortByEmailLabel },
          ]}
          pageSize={pageSize}
          previousLabel={labels.previousLabel}
          nextLabel={labels.nextLabel}
          emptyLabel={labels.emptyLabel}
        />
        {selected !== null && (
          <aside aria-label={labels.detailLabel} className={detailStyles}>
            <UserComponent
              name={selected.name}
              email={selected.email}
              avatarUrl={selected.avatarUrl}
              size="lg"
            />
            <dl className={detailRowsStyles}>
              {selected.group && (
                <div className={detailRowStyles}>
                  <dt className={detailTermStyles}>{labels.detailGroupLabel}</dt>
                  <dd className={detailValueStyles}>{selected.group}</dd>
                </div>
              )}
              <div className={detailRowStyles}>
                <dt className={detailTermStyles}>{labels.detailStatusLabel}</dt>
                <dd className={detailValueStyles}>
                  <Chip variant={STATUS_VARIANT[selected.status]}>
                    {labels.statusLabels[selected.status]}
                  </Chip>
                </dd>
              </div>
            </dl>
            <div className={detailCloseStyles}>
              <Button variant="secondary" size="sm" onClick={() => setSelectedId(null)}>
                {labels.closeDetailLabel}
              </Button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
