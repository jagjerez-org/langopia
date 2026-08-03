import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./Input.js";

const meta: Meta<typeof Input> = {
  title: "Atoms/Input",
  component: Input,
  tags: ["autodocs"],
  argTypes: {
    label: { control: "text" },
    hint: { control: "text" },
    error: { control: "text" },
    placeholder: { control: "text" },
    isLoading: { control: "boolean" },
    disabled: { control: "boolean" },
    required: { control: "boolean" },
    onChange: { action: "changed" },
  },
  args: {
    label: "Correo electrónico",
    placeholder: "nombre@academia.com",
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHint: Story = {
  args: { hint: "Usaremos este correo para las notificaciones." },
};

export const Required: Story = {
  args: { required: true },
};

export const WithError: Story = {
  args: {
    error: "El correo no tiene un formato válido.",
    defaultValue: "no-es-un-correo",
  },
};

export const Loading: Story = {
  args: { isLoading: true, label: "Nombre de usuario" },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: "bloqueado@academia.com" },
};

export const WithAdornments: Story = {
  args: {
    label: "Precio por hora",
    leadingAdornment: <span aria-hidden="true">€</span>,
    trailingAdornment: <span aria-hidden="true">/h</span>,
    defaultValue: "25",
  },
};

export const Password: Story = {
  args: { type: "password", label: "Contraseña" },
};
