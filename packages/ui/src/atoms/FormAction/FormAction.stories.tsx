import type { Meta, StoryObj } from "@storybook/react";
import { FormAction } from "./FormAction.js";

const meta: Meta<typeof FormAction> = {
  title: "Atoms/FormAction",
  component: FormAction,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "radio",
      options: ["primary", "secondary", "ghost", "danger"],
    },
    size: { control: "radio", options: ["sm", "md", "lg"] },
    type: { control: "radio", options: ["submit", "reset"] },
    isLoading: { control: "boolean" },
    onClick: { action: "clicked" },
  },
  args: {
    children: "Guardar cambios",
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Submit: Story = {};

export const Reset: Story = {
  args: { type: "reset", variant: "secondary", children: "Restablecer" },
};

export const Loading: Story = {
  args: { isLoading: true, children: "Guardando…" },
};

export const Link: Story = {
  args: { href: "#cancelar", variant: "ghost", children: "Cancelar" },
};

export const ActionBar: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
      <FormAction {...args} href="#volver" variant="ghost">
        Cancelar
      </FormAction>
      <FormAction {...args} type="reset" variant="secondary">
        Restablecer
      </FormAction>
      <FormAction {...args} type="submit" variant="primary">
        Guardar
      </FormAction>
    </div>
  ),
};
