import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Toggle } from "./Toggle.js";

const meta: Meta<typeof Toggle> = {
  title: "Atoms/Toggle",
  component: Toggle,
  tags: ["autodocs"],
  argTypes: {
    label: { control: "text" },
    checked: { control: "boolean" },
    disabled: { control: "boolean" },
    onChange: { action: "changed" },
  },
  args: {
    label: "Recibir recordatorios de clase",
    checked: false,
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Off: Story = {};

export const On: Story = {
  args: { checked: true },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const DisabledOn: Story = {
  args: { disabled: true, checked: true },
};

export const Controlled: Story = {
  render: function ControlledRender(args) {
    const [checked, setChecked] = useState(args.checked);
    return (
      <Toggle
        checked={checked}
        label={args.label}
        disabled={args.disabled}
        onChange={(next) => {
          setChecked(next);
          args.onChange?.(next);
        }}
      />
    );
  },
};
