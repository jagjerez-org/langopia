import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Selector } from "./Selector.js";

const OPTIONS = [
  { value: "es", label: "Español" },
  { value: "en", label: "Inglés" },
  { value: "de", label: "Alemán" },
  { value: "pt", label: "Portugués", disabled: true },
  { value: "gl", label: "Galego" },
];

const meta: Meta<typeof Selector> = {
  title: "Atoms/Selector",
  component: Selector,
  tags: ["autodocs"],
  argTypes: {
    label: { control: "text" },
    hint: { control: "text" },
    error: { control: "text" },
    placeholder: { control: "text" },
    isLoading: { control: "boolean" },
    disabled: { control: "boolean" },
    required: { control: "boolean" },
    onChange: { action: "changed" },
  },
  args: {
    label: "Idioma del curso",
    options: OPTIONS,
    placeholder: "Elige un idioma",
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHint: Story = {
  args: { hint: "Es el idioma en el que se imparten las clases." },
};

export const Required: Story = {
  args: { required: true },
};

export const WithError: Story = {
  args: { error: "Debes elegir un idioma para el curso." },
};

export const Loading: Story = {
  args: { isLoading: true },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: "es" },
};

export const Controlled: Story = {
  render: function ControlledRender(args) {
    const [value, setValue] = useState("en");
    return (
      <Selector
        label={args.label}
        options={args.options}
        placeholder={args.placeholder}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          args.onChange?.(event);
        }}
      />
    );
  },
};
