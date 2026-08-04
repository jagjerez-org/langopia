import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../Button/Button.js";
import { Chip } from "../Chip/Chip.js";
import { Panel } from "./Panel.js";

const meta: Meta<typeof Panel> = {
  title: "Atoms/Panel",
  component: Panel,
  tags: ["autodocs"],
  args: {
    title: "Alumnos del grupo B2",
    children: "El contenido libre del panel va aquí: tablas, formularios, estados de carga…",
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ConAcciones: Story = {
  args: {
    actions: (
      <>
        <Chip variant="success">Activo</Chip>
        <Button variant="secondary" size="sm">
          Añadir alumno
        </Button>
      </>
    ),
  },
};

export const ConPie: Story = {
  args: {
    footer: (
      <Button variant="ghost" size="sm">
        Ver todo
      </Button>
    ),
  },
};

export const SoloCuerpo: Story = {
  args: { title: undefined },
};
