import type { Meta, StoryObj } from "@storybook/react";
import { Textarea } from "./Textarea.js";

const meta: Meta<typeof Textarea> = {
  title: "Atoms/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  argTypes: {
    label: { control: "text" },
    hint: { control: "text" },
    error: { control: "text" },
    placeholder: { control: "text" },
    rows: { control: "number" },
    disabled: { control: "boolean" },
    required: { control: "boolean" },
    onChange: { action: "changed" },
  },
  args: {
    label: "Observaciones del alumno",
    placeholder: "Escribe aquí…",
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHint: Story = {
  args: { hint: "Visible para el equipo docente." },
};

export const Required: Story = {
  args: { required: true },
};

export const WithError: Story = {
  args: {
    error: "El texto supera el máximo permitido.",
    defaultValue: "Un texto de ejemplo que ya ocupa varias líneas\ny sigue creciendo.",
  },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: "Contenido bloqueado." },
};

export const Tall: Story = {
  args: { rows: 8 },
};
