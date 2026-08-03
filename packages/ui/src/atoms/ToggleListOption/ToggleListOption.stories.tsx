import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { ToggleListOption } from "./ToggleListOption.js";

const meta: Meta<typeof ToggleListOption> = {
  title: "Atoms/ToggleListOption",
  component: ToggleListOption,
  tags: ["autodocs"],
  argTypes: {
    label: { control: "text" },
    hint: { control: "text" },
    checked: { control: "boolean" },
    disabled: { control: "boolean" },
    onChange: { action: "changed" },
  },
  args: {
    label: "Correo electrónico",
    checked: true,
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Checked: Story = {};

export const Unchecked: Story = {
  args: { checked: false },
};

export const WithHint: Story = {
  args: { hint: "Visible solo en la vista detallada." },
};

export const Disabled: Story = {
  args: { disabled: true, hint: "Columna obligatoria." },
};

export const ColumnPicker: Story = {
  render: function ColumnPickerRender(args) {
    const [visible, setVisible] = useState<Record<string, boolean>>({
      nombre: true,
      correo: true,
      nivel: false,
    });
    const options = [
      { key: "nombre", label: "Nombre completo" },
      { key: "correo", label: "Correo electrónico" },
      { key: "nivel", label: "Nivel actual" },
    ];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: "22rem" }}>
        {options.map((option) => (
          <ToggleListOption
            key={option.key}
            {...args}
            label={option.label}
            checked={visible[option.key] ?? false}
            onChange={(next) => setVisible((prev) => ({ ...prev, [option.key]: next }))}
          />
        ))}
      </div>
    );
  },
};
