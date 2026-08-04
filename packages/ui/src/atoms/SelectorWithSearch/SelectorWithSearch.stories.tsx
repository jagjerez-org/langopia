import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { SelectorWithSearch } from "./SelectorWithSearch.js";

const OPTIONS = [
  { value: "es", label: "Español" },
  { value: "en", label: "Inglés" },
  { value: "de", label: "Alemán" },
  { value: "pt", label: "Portugués" },
  { value: "gl", label: "Galego", disabled: true },
  { value: "fr", label: "Francés" },
  { value: "it", label: "Italiano" },
];

const meta: Meta<typeof SelectorWithSearch> = {
  title: "Atoms/SelectorWithSearch",
  component: SelectorWithSearch,
  tags: ["autodocs"],
  argTypes: {
    label: { control: "text" },
    hint: { control: "text" },
    error: { control: "text" },
    placeholder: { control: "text" },
    noResultsLabel: { control: "text" },
    disabled: { control: "boolean" },
    onChange: { action: "changed" },
  },
  args: {
    label: "Idioma del curso",
    options: OPTIONS,
    placeholder: "Busca un idioma…",
    noResultsLabel: "Ningún idioma coincide con la búsqueda",
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDefaultValue: Story = {
  args: { defaultValue: "en" },
};

export const WithHint: Story = {
  args: { hint: "Empieza a teclear para filtrar la lista." },
};

export const WithError: Story = {
  args: { error: "Debes elegir un idioma para el curso." },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: "es" },
};

export const Controlled: Story = {
  render: function ControlledRender(args) {
    const [value, setValue] = useState<string | undefined>("es");
    return (
      <SelectorWithSearch
        label={args.label}
        options={args.options}
        placeholder={args.placeholder}
        noResultsLabel={args.noResultsLabel}
        value={value}
        onChange={(next) => {
          setValue(next);
          args.onChange?.(next);
        }}
      />
    );
  },
};
