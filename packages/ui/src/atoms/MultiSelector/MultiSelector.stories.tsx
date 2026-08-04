import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { MultiSelector } from "./MultiSelector.js";

const OPTIONS = [
  { value: "es", label: "Español" },
  { value: "en", label: "Inglés" },
  { value: "de", label: "Alemán", hint: "Solo grupos de mañana" },
  { value: "pt", label: "Portugués", disabled: true },
  { value: "gl", label: "Galego" },
];

const meta: Meta<typeof MultiSelector> = {
  title: "Atoms/MultiSelector",
  component: MultiSelector,
  tags: ["autodocs"],
  argTypes: {
    label: { control: "text" },
    hint: { control: "text" },
    error: { control: "text" },
    disabled: { control: "boolean" },
    onChange: { action: "changed" },
  },
  args: {
    label: "Idiomas que imparte el profesor",
    options: OPTIONS,
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDefaultValue: Story = {
  args: { defaultValue: ["es", "gl"] },
};

export const WithHint: Story = {
  args: { hint: "El profesor solo puede asignarse a cursos de estos idiomas." },
};

export const WithError: Story = {
  args: { error: "Selecciona al menos un idioma." },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: ["es"] },
};

export const Controlled: Story = {
  render: function ControlledRender(args) {
    const [value, setValue] = useState<string[]>(["en"]);
    return (
      <MultiSelector
        label={args.label}
        options={args.options}
        value={value}
        onChange={(values) => {
          setValue(values);
          args.onChange?.(values);
        }}
      />
    );
  },
};
