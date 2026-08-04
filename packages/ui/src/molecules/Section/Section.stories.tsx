import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Section } from "./Section.js";

const meta: Meta<typeof Section> = {
  title: "Molecules/Section",
  component: Section,
  tags: ["autodocs"],
  args: {
    title: "Detalles del documento",
    children: (
      <p>
        Metadatos, historial de cambios y permisos del documento. Esta zona se
        colapsa desde la cabecera.
      </p>
    ),
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ConTags: Story = {
  args: {
    tags: [
      { label: "3 pendientes", variant: "warning" },
      { label: "Borrador", variant: "neutral" },
    ],
  },
};

export const ColapsadaPorDefecto: Story = {
  args: {
    defaultExpanded: false,
  },
};

export const Controlada: Story = {
  render: function ControlledSection() {
    const [expanded, setExpanded] = useState(false);
    return (
      <Section title="Detalles del documento" expanded={expanded} onToggle={setExpanded}>
        <p>El estado de expansión lo posee quien llama ({expanded ? "abierta" : "cerrada"}).</p>
      </Section>
    );
  },
};
