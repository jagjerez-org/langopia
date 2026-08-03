import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { ThemeToggle } from "./ThemeToggle.js";
import type { Theme } from "../../lib/theme.js";

const meta: Meta<typeof ThemeToggle> = {
  title: "Atoms/ThemeToggle",
  component: ThemeToggle,
  tags: ["autodocs"],
  argTypes: {
    value: {
      control: "radio",
      options: ["light", "dark"] satisfies Theme[],
      description: "Tema actualmente seleccionado",
    },
    onChange: { action: "changed" },
    labels: { control: "object" },
  },
  args: {
    value: "light",
    labels: { light: "Claro", dark: "Oscuro" },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Controlled: Story = {
  render: function ControlledRender(args) {
    const [value, setValue] = useState<Theme>(args.value);
    return (
      <ThemeToggle
        value={value}
        labels={args.labels}
        onChange={(theme) => {
          setValue(theme);
          args.onChange?.(theme);
        }}
      />
    );
  },
};

export const Dark: Story = {
  args: {
    value: "dark",
  },
};

export const EnglishLabels: Story = {
  args: {
    labels: { light: "Light", dark: "Dark" },
  },
};
