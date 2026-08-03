import type { Meta, StoryObj } from "@storybook/react";
import { RadioButton } from "./RadioButton.js";

const meta: Meta<typeof RadioButton> = {
  title: "Atoms/RadioButton",
  component: RadioButton,
  tags: ["autodocs"],
  argTypes: {
    label: { control: "text" },
    hint: { control: "text" },
    disabled: { control: "boolean" },
    onChange: { action: "changed" },
  },
  args: {
    name: "nivel-demo",
    value: "b1",
    label: "Intermedio (B1)",
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Checked: Story = {
  args: { defaultChecked: true },
};

export const WithHint: Story = {
  args: { hint: "El nivel más demandado." },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const DisabledChecked: Story = {
  args: { disabled: true, defaultChecked: true },
};

export const Group: Story = {
  render: (args) => (
    <fieldset style={{ display: "flex", flexDirection: "column", gap: "0.75rem", border: "none", padding: 0, margin: 0 }}>
      <legend style={{ font: "inherit", padding: 0, marginBottom: "0.25rem" }}>Nivel del curso</legend>
      <RadioButton {...args} name="nivel-grupo" value="a1" label="Principiante (A1)" />
      <RadioButton {...args} name="nivel-grupo" value="a2" label="Elemental (A2)" defaultChecked />
      <RadioButton {...args} name="nivel-grupo" value="b1" label="Intermedio (B1)" />
    </fieldset>
  ),
};
