import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { MultiSelectorWithSearch } from "./MultiSelectorWithSearch.js";

const OPTIONS = [
  { value: "es", label: "Español" },
  { value: "en", label: "Inglés" },
  { value: "de", label: "Alemán" },
  { value: "pt", label: "Portugués" },
  { value: "gl", label: "Galego", disabled: true },
  { value: "fr", label: "Francés" },
  { value: "it", label: "Italiano" },
];

const meta: Meta<typeof MultiSelectorWithSearch> = {
  title: "Atoms/MultiSelectorWithSearch",
  component: MultiSelectorWithSearch,
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
    label: "Idiomas que imparte el profesor",
    options: OPTIONS,
    placeholder: "Busca un idioma…",
    noResultsLabel: "Ningún idioma coincide con la búsqueda",
    getRemoveLabel: (option: { value: string; label: string }) => `Quitar ${option.label}`,
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDefaultValue: Story = {
  args: { defaultValue: ["es", "en"] },
};

export const WithHint: Story = {
  args: { hint: "Empieza a teclear para filtrar; Retroceso quita la última elección." },
};

export const WithError: Story = {
  args: { error: "Selecciona al menos un idioma.", defaultValue: [] },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: ["es"] },
};

export const Controlled: Story = {
  render: function ControlledRender(args) {
    const [value, setValue] = useState<string[]>(["de"]);
    return (
      <MultiSelectorWithSearch
        label={args.label}
        options={args.options}
        placeholder={args.placeholder}
        noResultsLabel={args.noResultsLabel}
        getRemoveLabel={args.getRemoveLabel}
        value={value}
        onChange={(next) => {
          setValue(next);
          args.onChange?.(next);
        }}
      />
    );
  },
};
