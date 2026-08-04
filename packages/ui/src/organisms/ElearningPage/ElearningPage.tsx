import { useState } from "react";
import type { ChangeEvent, ReactElement } from "react";
import { Input } from "../../atoms/Input/Input.js";
import { Selector } from "../../atoms/Selector/Selector.js";
import { ActionBar } from "../../molecules/ActionBar/ActionBar.js";
import { Card } from "../../molecules/Card/Card.js";
import type { CardImage } from "../../molecules/Card/Card.js";
import { ListRow } from "../../molecules/ListRow/ListRow.js";

export interface ElearningLesson {
  /** Clave estable de la lección. */
  id: string;
  title: string;
  /** Duración ya formateada (p. ej. "12 min"). */
  duration?: string;
  completed: boolean;
}

export interface ElearningCourse {
  /** Clave estable del curso. */
  id: string;
  title: string;
  /** Categoría ya traducida: se muestra en el chip y alimenta el filtro. */
  category: string;
  /** Imagen de portada de la tarjeta. */
  image?: CardImage;
  /** Progreso del curso en tanto por ciento (0–100); si falta no se muestra. */
  progress?: number;
  lessons: ElearningLesson[];
}

/** Acción del menú de cada lección (marcar, ver material…). */
export interface ElearningLessonAction {
  id: string;
  /** Texto de la acción (ya traducido). */
  label: string;
}

export interface ElearningPageLabels {
  /** Título de la página. */
  title: string;
  /** Nombre accesible de la región con la rejilla de cursos. */
  catalogLabel: string;
  /** Etiqueta del buscador de cursos. */
  searchLabel: string;
  searchPlaceholder?: string;
  /** Etiqueta del selector de filtro por categoría. */
  categoryFilterLabel: string;
  /** Opción del filtro que muestra todas las categorías. */
  allCategoriesLabel: string;
  /** Estado vacío del catálogo (sin cursos o sin resultados). */
  emptyLabel: string;
  /** Texto del progreso de un curso (p. ej. "45 % completado"). */
  progressLabel: (progress: number) => string;
  /** Botón para volver del detalle al catálogo. */
  backLabel: string;
  /** Nombre accesible de la región con las lecciones del curso abierto. */
  lessonsListLabel: (courseTitle: string) => string;
  /** Chip de lección completada. */
  completedLabel: string;
  /** Chip de lección pendiente. */
  pendingLabel: string;
  /** Nombre accesible del menú de acciones de cada lección. */
  lessonActionsLabel: (lessonTitle: string) => string;
}

export interface ElearningPageProps {
  courses: ElearningCourse[];
  /** Acciones del menú de cada lección; sin ellas no hay menú. */
  lessonActions?: ElearningLessonAction[];
  /** Textos de la interfaz, ya traducidos. */
  labels: ElearningPageLabels;
  /** Notifica la apertura de un curso (el detalle también se muestra). */
  onOpenCourse: (courseId: string) => void;
  /** Notifica la acción elegida con los ids de curso, lección y acción. */
  onLessonAction?: (courseId: string, lessonId: string, actionId: string) => void;
}

const ALL_CATEGORIES = "all";

const wrapperStyles = "flex w-full flex-col gap-4";
const titleStyles =
  "m-0 font-sans text-[length:var(--ink-text-xl)] leading-[var(--ink-leading-xl)] font-bold text-text";
const controlsStyles = "flex flex-wrap items-end gap-2";
const controlStyles = "w-56";
const gridStyles = "m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3";
const progressStyles =
  "m-0 font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] text-muted";
const lessonListStyles = "m-0 flex list-none flex-col gap-0.5 p-0";
const emptyStyles =
  "m-0 py-10 text-center font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] text-muted";

/**
 * Catálogo de cursos e-learning: rejilla de `Card` con portada, categoría y
 * progreso, buscador y filtro por categoría (`Selector`) internos. Al abrir
 * un curso se muestra su detalle: una `ListRow` por lección con su estado
 * (completada/pendiente), su duración y un menú de acciones. Sin API: todo
 * llega por props y se notifica por callbacks.
 */
export function ElearningPage({
  courses,
  lessonActions,
  labels,
  onOpenCourse,
  onLessonAction,
}: ElearningPageProps): ReactElement {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [openCourseId, setOpenCourseId] = useState<string | null>(null);

  // Categorías presentes en los datos, sin duplicar y en orden de aparición.
  const categories = [...new Set(courses.map((course) => course.category))];

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visible = courses.filter(
    (course) =>
      (category === ALL_CATEGORIES || course.category === category) &&
      (normalizedQuery === "" || course.title.toLocaleLowerCase().includes(normalizedQuery)),
  );

  const openCourse = courses.find((course) => course.id === openCourseId) ?? null;

  const changeQuery = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };

  const changeCategory = (event: ChangeEvent<HTMLSelectElement>) => {
    setCategory(event.target.value);
  };

  const selectCourse = (courseId: string) => {
    setOpenCourseId(courseId);
    onOpenCourse(courseId);
  };

  if (openCourse !== null) {
    return (
      <div className={wrapperStyles}>
        <ActionBar
          title={openCourse.title}
          actions={[{ label: labels.backLabel, onClick: () => setOpenCourseId(null) }]}
        />
        <section aria-label={labels.lessonsListLabel(openCourse.title)}>
          {openCourse.lessons.length === 0 ? (
            <p className={emptyStyles}>{labels.emptyLabel}</p>
          ) : (
            <ul className={lessonListStyles}>
              {openCourse.lessons.map((lesson) => (
                <li key={lesson.id}>
                  <ListRow
                    title={lesson.title}
                    subtitle={lesson.duration}
                    tags={[
                      lesson.completed
                        ? { label: labels.completedLabel, variant: "success" }
                        : { label: labels.pendingLabel, variant: "neutral" },
                    ]}
                    actions={
                      lessonActions !== undefined && onLessonAction !== undefined
                        ? lessonActions.map((action) => ({
                            label: action.label,
                            onClick: () => onLessonAction(openCourse.id, lesson.id, action.id),
                          }))
                        : undefined
                    }
                    actionsLabel={labels.lessonActionsLabel(lesson.title)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className={wrapperStyles}>
      <h1 className={titleStyles}>{labels.title}</h1>
      <div className={controlsStyles}>
        <div className={controlStyles}>
          <Input
            label={labels.searchLabel}
            type="search"
            placeholder={labels.searchPlaceholder}
            value={query}
            onChange={changeQuery}
          />
        </div>
        <div className={controlStyles}>
          <Selector
            label={labels.categoryFilterLabel}
            options={[
              { value: ALL_CATEGORIES, label: labels.allCategoriesLabel },
              ...categories.map((option) => ({ value: option, label: option })),
            ]}
            value={category}
            onChange={changeCategory}
          />
        </div>
      </div>
      <section aria-label={labels.catalogLabel}>
        {visible.length === 0 ? (
          <p className={emptyStyles}>{labels.emptyLabel}</p>
        ) : (
          <ul className={gridStyles}>
            {visible.map((course) => (
              <li key={course.id}>
                <Card
                  title={course.title}
                  image={course.image}
                  tags={[{ label: course.category, variant: "accent" }]}
                  onClick={() => selectCourse(course.id)}
                >
                  {course.progress !== undefined && (
                    <p className={progressStyles}>{labels.progressLabel(course.progress)}</p>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
