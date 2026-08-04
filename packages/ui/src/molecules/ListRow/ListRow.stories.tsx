import type { Meta, StoryObj } from "@storybook/react";
import { ListRow } from "./ListRow.js";
import { listRowBase, rowActions } from "../../fixtures/lists.js";

const meta: Meta<typeof ListRow> = {
  title: "Molecules/ListRow",
  component: ListRow,
  tags: ["autodocs"],
  args: listRowBase,
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SinAccesorios: Story = {
  args: {
    title: "Acta de la reunión de junio",
    subtitle: undefined,
    tags: undefined,
    avatar: undefined,
    actions: undefined,
    actionsLabel: undefined,
  },
};

export const Enlace: Story = {
  args: {
    ...listRowBase,
    actions: undefined,
    actionsLabel: undefined,
    href: "/documentos/doc-1",
  },
};

export const Clickable: Story = {
  args: {
    ...listRowBase,
    onClick: () => alert("Fila pulsada"),
  },
};

export const SoloAcciones: Story = {
  args: {
    title: "Plan de contingencia",
    actions: rowActions,
    actionsLabel: "Acciones de Plan de contingencia",
  },
};

export const Activa: Story = {
  args: {
    ...listRowBase,
    active: true,
  },
};
