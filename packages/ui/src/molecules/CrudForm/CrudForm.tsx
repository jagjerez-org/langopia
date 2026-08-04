import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import type { Control, FieldErrors } from "react-hook-form";
import { z } from "zod";
import {
  Button,
  FormAction,
  Input,
  MultiSelector,
  Selector,
  Textarea,
  Toggle,
} from "../../atoms/index.js";
import type { MultiSelectorOption } from "../../atoms/index.js";
import { useServerError } from "../lib/use-server-error.js";
import { zodResolver } from "../lib/zod-resolver.js";

export type CrudFieldType =
  | "text"
  | "email"
  | "password"
  | "number"
  | "date"
  | "textarea"
  | "select"
  | "multiselect"
  | "toggle";

export interface CrudField {
  /** Clave del valor en el objeto que recibe `onSubmit`. */
  name: string;
  /** Etiqueta visible, ya traducida. */
  label: ReactNode;
  /** Tipo de control. Por defecto "text". */
  type?: CrudFieldType;
  required?: boolean;
  /** Ayuda contextual bajo el control (se oculta si hay error). */
  hint?: ReactNode;
  placeholder?: string;
  /** Opciones para "select" y "multiselect" (el `hint` solo lo pinta el multiselect). */
  options?: MultiSelectorOption[];
}

export type CrudFormValues = Record<string, string | number | boolean | string[] | undefined>;

export interface CrudFormProps {
  fields: CrudField[];
  /** Valores iniciales por nombre de campo (modo edición). */
  defaultValues?: Partial<CrudFormValues>;
  /**
   * Recibe los datos ya validados (los "number" llegan como `number`). Si
   * devuelve una promesa y rechaza, su `Error.message` se muestra como error
   * de servidor.
   */
  onSubmit: (values: CrudFormValues) => void | Promise<void>;
  /** Si se pasa, aparece el botón secundario de cancelar. */
  onCancel?: () => void;
  /** Error de servidor controlado desde fuera (ya traducido), con role="alert". */
  error?: ReactNode;
  /** Estado de envío impuesto desde fuera, además del derivado de `onSubmit`. */
  isLoading?: boolean;
  submitLabel?: ReactNode;
  cancelLabel?: ReactNode;
  /** Mensaje cuando falta un campo obligatorio. */
  requiredErrorMessage?: string;
  /** Mensaje cuando un campo "email" no tiene formato válido. */
  emailErrorMessage?: string;
  /** Mensaje cuando un campo "number" no es numérico. */
  numberErrorMessage?: string;
  /** Reserva cuando la promesa de `onSubmit` rechaza sin mensaje usable. */
  serverErrorMessage?: string;
}

interface CrudMessages {
  required: string;
  email: string;
  number: string;
}

/**
 * Construye el esquema zod a partir de la descripción de campos. Los valores
 * llegan de controles HTML, así que todo nace como string (o string[] /
 * boolean en multiselect y toggle) y aquí se valida y se transforma:
 * los "number" salen como `number` (o `undefined` si son opcionales y vacíos).
 */
function buildCrudSchema(fields: CrudField[], messages: CrudMessages): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    const type = field.type ?? "text";
    const required = field.required ?? false;
    let schema: z.ZodTypeAny;

    switch (type) {
      case "email":
        schema = required
          ? z.string().min(1, messages.required).pipe(z.email(messages.email))
          : z.email(messages.email).or(z.literal(""));
        break;
      case "number":
        schema = required
          ? z
              .string()
              .min(1, messages.required)
              .refine((value) => !Number.isNaN(Number(value)), messages.number)
              .transform(Number)
          : z
              .string()
              .refine((value) => value === "" || !Number.isNaN(Number(value)), messages.number)
              .transform((value) => (value === "" ? undefined : Number(value)));
        break;
      case "multiselect":
        schema = required ? z.array(z.string()).min(1, messages.required) : z.array(z.string());
        break;
      case "toggle":
        schema = required
          ? z.boolean().refine((value) => value, messages.required)
          : z.boolean();
        break;
      // text, password, date, textarea y select comparten validación de texto.
      default:
        schema = required ? z.string().min(1, messages.required) : z.string();
        break;
    }

    shape[field.name] = schema;
  }

  return z.object(shape);
}

/** Valor inicial coherente con el control: string "", [] o false. */
function emptyValueFor(field: CrudField): string | boolean | string[] {
  const type = field.type ?? "text";
  if (type === "multiselect") return [];
  if (type === "toggle") return false;
  return "";
}

const formStyles = "flex w-full flex-col gap-4";
const fieldGroupStyles = "flex w-full flex-col gap-1";
const actionsStyles = "flex items-center justify-end gap-2";
const errorStyles =
  "m-0 text-[length:var(--ink-text-xs)] leading-[var(--ink-leading-xs)] font-medium text-critical";
const serverErrorStyles =
  "m-0 rounded-md border border-critical bg-critical-bg px-3 py-2 text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] font-medium text-critical";

interface FieldControlProps {
  field: CrudField;
  control: Control<CrudFormValues, unknown, CrudFormValues>;
  register: ReturnType<typeof useForm<CrudFormValues, unknown, CrudFormValues>>["register"];
  errors: FieldErrors<CrudFormValues>;
  isBusy: boolean;
}

/** Renderiza el átomo adecuado para cada tipo de campo. */
function FieldControl({ field, control, register, errors, isBusy }: FieldControlProps): ReactElement {
  const type = field.type ?? "text";
  const required = field.required ?? false;
  const error = errors[field.name]?.message;

  if (type === "textarea") {
    return (
      <Textarea
        label={field.label}
        hint={field.hint}
        placeholder={field.placeholder}
        required={required}
        disabled={isBusy}
        error={error}
        {...register(field.name)}
      />
    );
  }

  if (type === "select") {
    return (
      <Selector
        label={field.label}
        hint={field.hint}
        placeholder={field.placeholder}
        options={field.options ?? []}
        required={required}
        disabled={isBusy}
        error={error}
        {...register(field.name)}
      />
    );
  }

  if (type === "multiselect") {
    return (
      <Controller
        name={field.name}
        control={control}
        render={({ field: controllerField }) => (
          <MultiSelector
            label={field.label}
            hint={field.hint}
            options={field.options ?? []}
            value={Array.isArray(controllerField.value) ? controllerField.value : []}
            onChange={controllerField.onChange}
            disabled={isBusy}
            error={error}
          />
        )}
      />
    );
  }

  if (type === "toggle") {
    return (
      <Controller
        name={field.name}
        control={control}
        render={({ field: controllerField }) => (
          <div className={fieldGroupStyles}>
            <Toggle
              ref={controllerField.ref}
              checked={controllerField.value === true}
              onChange={controllerField.onChange}
              onBlur={controllerField.onBlur}
              label={field.label}
              disabled={isBusy}
              aria-invalid={Boolean(error) || undefined}
            />
            {error && (
              <p role="alert" className={errorStyles}>
                {error}
              </p>
            )}
          </div>
        )}
      />
    );
  }

  // text, email, password, number y date: todos son `Input` con su type.
  return (
    <Input
      label={field.label}
      hint={field.hint}
      placeholder={field.placeholder}
      type={type}
      required={required}
      disabled={isBusy}
      error={error}
      {...register(field.name)}
    />
  );
}

/**
 * Formulario genérico de creación/edición: recibe la descripción de campos
 * por props, construye el esquema zod dinámicamente y renderiza con los
 * átomos del paquete. Es la base de los CRUD de gestión.
 */
export function CrudForm({
  fields,
  defaultValues,
  onSubmit,
  onCancel,
  error,
  isLoading = false,
  submitLabel = "Guardar",
  cancelLabel = "Cancelar",
  requiredErrorMessage = "Este campo es obligatorio.",
  emailErrorMessage = "Introduce un correo electrónico válido.",
  numberErrorMessage = "Introduce un número válido.",
  serverErrorMessage = "No se pudo guardar. Inténtalo de nuevo.",
}: CrudFormProps): ReactElement {
  const messages: CrudMessages = {
    required: requiredErrorMessage,
    email: emailErrorMessage,
    number: numberErrorMessage,
  };
  const messagesKey = [requiredErrorMessage, emailErrorMessage, numberErrorMessage].join("");

  const schema = useMemo(
    () => buildCrudSchema(fields, messages),
    // `messages` se deriva de las props recogidas en messagesKey; fields se
    // compara por referencia, como hace react-hook-form con `defaultValues`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fields, messagesKey],
  );

  const initialValues = useMemo(() => {
    const values: CrudFormValues = {};
    for (const field of fields) {
      values[field.name] = defaultValues?.[field.name] ?? emptyValueFor(field);
    }
    return values;
  }, [fields, defaultValues]);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CrudFormValues, unknown, CrudFormValues>({
    // El esquema es dinámico (su forma depende de las props), así que no puede
    // expresarse en el sistema de tipos: el cuello de botella tipado es la
    // firma pública `CrudFormValues`, y el cast concentra aquí esa frontera.
    resolver: zodResolver(schema as z.ZodType<CrudFormValues, CrudFormValues>),
    defaultValues: initialValues,
  });

  const { serverError, wrapSubmit } = useServerError(error, serverErrorMessage);
  const isBusy = isLoading || isSubmitting;

  return (
    <form noValidate onSubmit={handleSubmit(wrapSubmit(onSubmit))} className={formStyles}>
      {fields.map((field) => (
        <FieldControl
          key={field.name}
          field={field}
          control={control}
          register={register}
          errors={errors}
          isBusy={isBusy}
        />
      ))}
      {serverError && (
        <p role="alert" className={serverErrorStyles}>
          {serverError}
        </p>
      )}
      <div className={actionsStyles}>
        {onCancel !== undefined && (
          <Button type="button" variant="secondary" disabled={isBusy} onClick={onCancel}>
            {cancelLabel}
          </Button>
        )}
        <FormAction type="submit" isLoading={isBusy}>
          {submitLabel}
        </FormAction>
      </div>
    </form>
  );
}
