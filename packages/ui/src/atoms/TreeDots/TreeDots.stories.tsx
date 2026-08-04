import type { Meta, StoryObj } from "@storybook/react";
import { TreeDots } from "./TreeDots.js";

const itemStyles =
  "block w-full cursor-pointer rounded-sm border-none bg-transparent px-2 py-1.5 text-left text-[length:var(--ink-text-base)] text-text hover:bg-surface-secondary";

/** Contenido de ejemplo: la molécula de menú aportará los ítems reales. */
function MenuItems() {
  return (
    <div className="flex flex-col">
      <button type="button" className={itemStyles}>
        Duplicar
      </button>
      <button type="button" className={itemStyles}>
        Archivar
      </button>
      <button type="button" className={itemStyles}>
        Eliminar
      </button>
    </div>
  );
}

const meta: Meta<typeof TreeDots> = {
  title: "Atoms/TreeDots",
  component: TreeDots,
  tags: ["autodocs"],
  argTypes: {
    triggerLabel: { control: "text", description: "Nombre accesible del disparador" },
    align: {
      control: "radio",
      options: ["start", "end"],
      description: "Borde del disparador al que se alinea el popup",
    },
    disabled: { control: "boolean" },
  },
  args: {
    triggerLabel: "Más acciones de la reserva",
    align: "end",
    children: <MenuItems />,
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AlignStart: Story = {
  args: { align: "start" },
};

export const Disabled: Story = {
  args: { disabled: true },
};
