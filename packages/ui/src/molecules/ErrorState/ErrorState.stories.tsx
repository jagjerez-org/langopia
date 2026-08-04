import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../../atoms/Button/Button.js";
import { ErrorState } from "./ErrorState.js";

const meta: Meta<typeof ErrorState> = {
  title: "Molecules/ErrorState",
  component: ErrorState,
  tags: ["autodocs"],
  args: {
    title: "No se pudo cargar la lista de alumnos",
    description: "traceId: 4f8c2a1e-9b3d-4e7f",
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ConReintento: Story = {
  args: {
    action: (
      <Button size="sm" variant="secondary">
        Reintentar
      </Button>
    ),
  },
};

export const SoloTitulo: Story = {
  args: { description: undefined },
};
