import { useRef, useState } from "react";
import type { ReactElement } from "react";
import { Button } from "../../atoms/Button/Button.js";
import { Chip } from "../../atoms/Chip/Chip.js";
import { Input } from "../../atoms/Input/Input.js";
import { Selector } from "../../atoms/Selector/Selector.js";
import { Textarea } from "../../atoms/Textarea/Textarea.js";
import { ActionBar } from "../../molecules/ActionBar/ActionBar.js";
import { CrudForm } from "../../molecules/CrudForm/CrudForm.js";
import type { CrudFormValues } from "../../molecules/CrudForm/CrudForm.js";
import { ListRow } from "../../molecules/ListRow/ListRow.js";
import { Section } from "../../molecules/Section/Section.js";

/**
 * Tipos de ejercicio soportados, como constante exportada: la app traduce cada
 * valor a su etiqueta visible por props (`typeOptions`).
 */
export const EXERCISE_TYPES = ["multiple_choice", "short_answer", "matching"] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

/** Pregunta del ejercicio: enunciado y respuesta esperada (datos neutros). */
export interface ExerciseQuestion {
  /** Clave estable de la pregunta. */
  id: string;
  /** Enunciado de la pregunta. */
  prompt: string;
  /** Respuesta correcta o esperada. */
  answer: string;
}

/** Definición completa del ejercicio que notifican `onChange`/`onSave`. */
export interface ExerciseDefinition {
  title: string;
  statement: string;
  type: ExerciseType;
  questions: ExerciseQuestion[];
}

/** Opción visible del selector de tipo: valor estable + etiqueta traducida. */
export interface ExerciseTypeOption {
  value: ExerciseType;
  label: string;
}

export interface ExerciseBuilderLabels {
  /** Título de la sección de definición del ejercicio. */
  definitionTitle: string;
  /** Etiqueta del campo de título. */
  titleLabel: string;
  /** Etiqueta del campo de enunciado. */
  statementLabel: string;
  /** Etiqueta del selector de tipo. */
  typeLabel: string;
  /** Título de la sección de preguntas. */
  questionsTitle: string;
  /** Texto cuando no hay preguntas. */
  questionsEmptyLabel: string;
  /** Botón para añadir una pregunta. */
  addQuestionLabel: string;
  /** Prefijo del nombre accesible del menú de cada pregunta (p. ej. "Acciones de"). */
  questionActionsLabel: string;
  /** Acción de editar la pregunta. */
  editLabel: string;
  /** Acción de eliminar la pregunta. */
  removeLabel: string;
  /** Etiqueta del campo de enunciado de la pregunta. */
  questionPromptLabel: string;
  /** Etiqueta del campo de respuesta de la pregunta. */
  questionAnswerLabel: string;
  /** Botón de guardar la pregunta en edición. */
  saveQuestionLabel: string;
  /** Botón de cancelar la edición de la pregunta. */
  cancelEditLabel: string;
  /** Título de la sección de previsualización (vista del alumno). */
  previewTitle: string;
  /** Acción de guardar el ejercicio. */
  saveLabel: string;
}

export interface ExerciseBuilderProps {
  /** Opciones del selector de tipo, ya traducidas. */
  typeOptions: ExerciseTypeOption[];
  /**
   * Ejercicio inicial (modo edición). Solo se lee en el montaje: el estado
   * es interno y no controlado — cambiar esta prop después no actualiza el
   * constructor.
   */
  initialExercise?: ExerciseDefinition;
  /** Textos de la interfaz, ya traducidos. */
  labels: ExerciseBuilderLabels;
  /** Notifica la definición completa tras cada cambio. */
  onChange?: (exercise: ExerciseDefinition) => void;
  /** Acción de guardar: recibe la definición completa. */
  onSave?: (exercise: ExerciseDefinition) => void;
}

const wrapperStyles = "flex w-full flex-col gap-4";
const definitionStyles = "flex flex-col gap-3";
const listStyles = "m-0 flex list-none flex-col gap-0.5 p-0";
const emptyStyles =
  "m-0 py-6 text-center font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] text-muted";
const questionFormStyles = "mt-3 border-t border-border pt-3";
const previewStyles = "flex flex-col gap-2";
const previewTitleStyles =
  "m-0 font-sans text-[length:var(--ink-text-lg)] leading-[var(--ink-leading-lg)] font-semibold text-text";
const previewStatementStyles =
  "m-0 font-sans text-[length:var(--ink-text-base)] leading-[var(--ink-leading-base)] text-muted";
const previewListStyles =
  "m-0 flex list-decimal flex-col gap-1 pl-5 font-sans text-[length:var(--ink-text-base)] leading-[var(--ink-leading-base)] text-text";

/** Estado de edición de pregunta: "new" o el id de la que se edita. */
type EditingQuestion = "new" | string | null;

/**
 * Constructor de ejercicios: formulario de definición (título, enunciado y
 * tipo), lista de preguntas con añadir/editar/eliminar (formulario en línea
 * con `CrudForm`) y previsualización tal como la vería el alumno.
 *
 * El modelo de pregunta es deliberadamente neutro (enunciado + respuesta):
 * las particularidades de cada tipo (opciones, parejas…) las resolverá la app
 * al conectar el dominio. Es presentacional: cada cambio se notifica por
 * `onChange` y el guardado entrega la definición completa.
 */
export function ExerciseBuilder({
  typeOptions,
  initialExercise,
  labels,
  onChange,
  onSave,
}: ExerciseBuilderProps): ReactElement {
  const [title, setTitle] = useState(initialExercise?.title ?? "");
  const [statement, setStatement] = useState(initialExercise?.statement ?? "");
  const [type, setType] = useState<ExerciseType>(
    initialExercise?.type ?? typeOptions[0]?.value ?? EXERCISE_TYPES[0],
  );
  const [questions, setQuestions] = useState<ExerciseQuestion[]>(initialExercise?.questions ?? []);
  const [editing, setEditing] = useState<EditingQuestion>(null);
  // Contador para ids de preguntas nuevas; el prefijo "new-" evita colisiones
  // con los ids de `initialExercise.questions`, que los asigna la app.
  const nextId = useRef(1);

  /** Aplica el cambio y notifica la definición resultante. */
  const emit = (patch: Partial<ExerciseDefinition>) => {
    const exercise: ExerciseDefinition = { title, statement, type, questions, ...patch };
    onChange?.(exercise);
  };

  const saveQuestion = (values: CrudFormValues) => {
    const prompt = String(values.prompt ?? "");
    const answer = String(values.answer ?? "");
    let next: ExerciseQuestion[];
    if (editing === "new") {
      next = [...questions, { id: `new-q-${nextId.current}`, prompt, answer }];
      nextId.current += 1;
    } else {
      next = questions.map((question) =>
        question.id === editing ? { ...question, prompt, answer } : question,
      );
    }
    setQuestions(next);
    setEditing(null);
    emit({ questions: next });
  };

  const removeQuestion = (id: string) => {
    const next = questions.filter((question) => question.id !== id);
    setQuestions(next);
    if (editing === id) setEditing(null);
    emit({ questions: next });
  };

  const editingQuestion =
    editing !== null && editing !== "new"
      ? questions.find((question) => question.id === editing)
      : undefined;

  const typeLabel = typeOptions.find((option) => option.value === type)?.label ?? type;

  return (
    <div className={wrapperStyles}>
      {onSave !== undefined && (
        <ActionBar
          actions={[
            {
              label: labels.saveLabel,
              variant: "primary",
              onClick: () => onSave({ title, statement, type, questions }),
            },
          ]}
        />
      )}
      <Section title={labels.definitionTitle}>
        <div className={definitionStyles}>
          <Input
            label={labels.titleLabel}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              emit({ title: event.target.value });
            }}
          />
          <Textarea
            label={labels.statementLabel}
            value={statement}
            onChange={(event) => {
              setStatement(event.target.value);
              emit({ statement: event.target.value });
            }}
          />
          <Selector
            label={labels.typeLabel}
            options={typeOptions}
            value={type}
            onChange={(event) => {
              const nextType = event.target.value as ExerciseType;
              setType(nextType);
              emit({ type: nextType });
            }}
          />
        </div>
      </Section>
      <Section title={labels.questionsTitle}>
        {questions.length === 0 ? (
          <p className={emptyStyles}>{labels.questionsEmptyLabel}</p>
        ) : (
          <ul className={listStyles}>
            {questions.map((question) => (
              <li key={question.id}>
                <ListRow
                  title={question.prompt}
                  subtitle={question.answer}
                  actionsLabel={`${labels.questionActionsLabel} ${question.prompt}`}
                  actions={[
                    { label: labels.editLabel, onClick: () => setEditing(question.id) },
                    { label: labels.removeLabel, onClick: () => removeQuestion(question.id) },
                  ]}
                />
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3">
          <Button variant="secondary" size="sm" onClick={() => setEditing("new")}>
            {labels.addQuestionLabel}
          </Button>
        </div>
        {editing !== null && (editing === "new" || editingQuestion !== undefined) && (
          <div className={questionFormStyles}>
            <CrudForm
              key={editing === "new" ? "new" : editing}
              fields={[
                { name: "prompt", label: labels.questionPromptLabel, type: "textarea", required: true },
                { name: "answer", label: labels.questionAnswerLabel, required: true },
              ]}
              defaultValues={
                editingQuestion
                  ? { prompt: editingQuestion.prompt, answer: editingQuestion.answer }
                  : undefined
              }
              submitLabel={labels.saveQuestionLabel}
              cancelLabel={labels.cancelEditLabel}
              onSubmit={saveQuestion}
              onCancel={() => setEditing(null)}
            />
          </div>
        )}
      </Section>
      <Section title={labels.previewTitle}>
        <div className={previewStyles}>
          <h3 className={previewTitleStyles}>{title}</h3>
          {statement && <p className={previewStatementStyles}>{statement}</p>}
          <div>
            <Chip variant="accent">{typeLabel}</Chip>
          </div>
          {questions.length > 0 && (
            <ol className={previewListStyles}>
              {questions.map((question) => (
                <li key={question.id}>{question.prompt}</li>
              ))}
            </ol>
          )}
        </div>
      </Section>
    </div>
  );
}
