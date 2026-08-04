import type { Meta, StoryObj } from "@storybook/react";
import { Chip } from "./Chip.js";
import type { ChipVariant } from "./Chip.js";

const meta: Meta<typeof Chip> = {
  title: "Atoms/Chip",
  component: Chip,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "radio",
      options: ["neutral", "accent", "success", "warning", "critical"] satisfies ChipVariant[],
      description: "Color/estado semántico de la etiqueta",
    },
    disabled: { control: "boolean" },
    removeLabel: { control: "text" },
    onRemove: { action: "removed" },
  },
  args: {
    children: "En curso",
    variant: "neutral",
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Neutral: Story = {};

export const Accent: Story = {
  args: { variant: "accent", children: "Seleccionado" },
};

export const Success: Story = {
  args: { variant: "success", children: "Al día" },
};

export const Warning: Story = {
  args: { variant: "warning", children: "Pendiente de revisar" },
};

export const Critical: Story = {
  args: { variant: "critical", children: "Riesgo de baja" },
};

export const Removable: Story = {
  args: {
    children: "Nivel B2",
    removeLabel: "Quitar nivel B2",
    onRemove: () => {},
  },
};

export const RemovableDisabled: Story = {
  args: {
    children: "Matrícula cerrada",
    removeLabel: "Quitar matrícula cerrada",
    onRemove: () => {},
    disabled: true,
  },
};

export const AllVariants: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
      {(["neutral", "accent", "success", "warning", "critical"] as const).map((variant) => (
        <Chip key={variant} {...args} variant={variant}>
          {variant}
        </Chip>
      ))}
    </div>
  ),
};
