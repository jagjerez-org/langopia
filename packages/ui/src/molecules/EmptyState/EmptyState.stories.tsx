import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../../atoms/Button/Button.js";
import { EmptyState } from "./EmptyState.js";

const meta: Meta<typeof EmptyState> = {
  title: "Molecules/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  args: {
    title: "Todavía no hay alumnos",
    description: "Cuando añadas el primero aparecerá aquí con su nivel y su grupo.",
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ConAccion: Story = {
  args: {
    action: <Button size="sm">Añadir alumno</Button>,
  },
};

export const SoloTitulo: Story = {
  args: { description: undefined },
};
