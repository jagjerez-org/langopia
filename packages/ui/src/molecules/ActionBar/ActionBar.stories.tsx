import type { Meta, StoryObj } from "@storybook/react";
import { IconCheck } from "../../atoms/Icons/Icons.js";
import { ActionBar } from "./ActionBar.js";

const meta: Meta<typeof ActionBar> = {
  title: "Molecules/ActionBar",
  component: ActionBar,
  tags: ["autodocs"],
  argTypes: {
    sticky: { control: "boolean" },
  },
  args: {
    actions: [
      { label: "Cancelar", onClick: () => {} },
      { label: "Guardar", onClick: () => {}, variant: "primary" },
    ],
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithTitle: Story = {
  args: {
    title: "Ficha de alumno",
    actions: [
      { label: "Archivar", onClick: () => {}, variant: "ghost" },
      { label: "Editar", onClick: () => {}, variant: "primary", icon: <IconCheck /> },
    ],
  },
};

export const WithLinks: Story = {
  args: {
    actions: [
      { label: "Volver al listado", href: "/alumnos" },
      { label: "Nuevo alumno", href: "/alumnos/nuevo", variant: "primary" },
    ],
  },
};

export const StickyBottom: Story = {
  args: { sticky: true },
  decorators: [
    (Story) => (
      <div className="flex h-48 flex-col justify-end">
        <Story />
      </div>
    ),
  ],
};

export const Loading: Story = {
  args: {
    actions: [
      { label: "Eliminar", onClick: () => {}, variant: "danger", disabled: true },
      { label: "Guardar", onClick: () => {}, variant: "primary", isLoading: true },
    ],
  },
};
