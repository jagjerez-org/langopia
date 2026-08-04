import type { Meta, StoryObj } from "@storybook/react";
import { Skeleton } from "./Skeleton.js";
import type { SkeletonHeight, SkeletonVariant } from "./Skeleton.js";

const meta: Meta<typeof Skeleton> = {
  title: "Atoms/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "radio",
      options: ["text", "circle", "rect"] satisfies SkeletonVariant[],
      description: "Forma del marcador de posición",
    },
    lines: { control: { type: "number", min: 1, max: 8 } },
    height: {
      control: "radio",
      options: [undefined, "xs", "sm", "md", "lg", "xl"] satisfies (SkeletonHeight | undefined)[],
      description: "Altura predefinida (solo variante rect)",
    },
    className: {
      control: "text",
      description: "Dimensiones del placeholder como utilidades Tailwind (sustituye al ancho por defecto)",
    },
  },
  args: {
    variant: "text",
    lines: 3,
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Texto: Story = {};

export const UnRenglon: Story = {
  args: { lines: 1 },
};

export const Circulo: Story = {
  args: { variant: "circle" },
};

export const Rectangulo: Story = {
  args: { variant: "rect", height: "md" },
};

export const AlturasRectangulo: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {(["xs", "sm", "md", "lg", "xl"] as const).map((height) => (
        <Skeleton key={height} variant="rect" height={height} />
      ))}
    </div>
  ),
};

/** Casos reales de la app: la barra de ocupación del dashboard y la cifra grande de un indicador. */
export const MedidasPropias: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <Skeleton variant="text" className="w-2/5" />
      <Skeleton variant="rect" className="h-2" />
      <Skeleton variant="text" className="h-[var(--ink-text-3xl)] w-16" />
    </div>
  ),
};
