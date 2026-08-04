import type { Meta, StoryObj } from "@storybook/react";
import { CrudForm } from "./CrudForm.js";
import type { CrudField } from "./CrudForm.js";

const courseFields: CrudField[] = [
  { name: "title", label: "Título", required: true, placeholder: "Inglés B2 intensivo" },
  {
    name: "description",
    label: "Descripción",
    type: "textarea",
    hint: "Se muestra en la ficha pública del curso.",
  },
  { name: "price", label: "Precio (€)", type: "number", required: true },
  {
    name: "level",
    label: "Nivel",
    type: "select",
    required: true,
    placeholder: "Elige un nivel",
    options: [
      { value: "a1", label: "A1 — Principiante" },
      { value: "a2", label: "A2 — Elemental" },
      { value: "b1", label: "B1 — Intermedio" },
      { value: "b2", label: "B2 — Intermedio alto" },
    ],
  },
  {
    name: "modalities",
    label: "Modalidades",
    type: "multiselect",
    options: [
      { value: "online", label: "Online", hint: "Clases por videollamada" },
      { value: "presencial", label: "Presencial", hint: "En el centro" },
      { value: "hibrida", label: "Híbrida" },
    ],
  },
  { name: "startDate", label: "Fecha de inicio", type: "date" },
  { name: "published", label: "Publicado en el catálogo", type: "toggle" },
];

const meta: Meta<typeof CrudForm> = {
  title: "Molecules/CrudForm",
  component: CrudForm,
  tags: ["autodocs"],
  argTypes: {
    onSubmit: { action: "submitted" },
    onCancel: { action: "cancelled" },
    error: { control: "text" },
    isLoading: { control: "boolean" },
  },
  args: {
    fields: courseFields,
    onCancel: () => {},
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Create: Story = {};

export const Edit: Story = {
  args: {
    defaultValues: {
      title: "Inglés B2 intensivo",
      description: "Curso de 12 semanas con dos sesiones por semana.",
      price: 240,
      level: "b2",
      modalities: ["online", "hibrida"],
      startDate: "2026-09-14",
      published: true,
    },
  },
};

export const WithServerError: Story = {
  args: { error: "Ya existe un curso con ese título." },
};

export const Loading: Story = {
  args: { isLoading: true },
};

export const RejectingSubmit: Story = {
  args: {
    onSubmit: async () => {
      throw new Error("No se pudo guardar el curso.");
    },
  },
};
