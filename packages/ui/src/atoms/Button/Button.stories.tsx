import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button.js";
import type { ButtonSize, ButtonVariant } from "./Button.js";

const meta: Meta<typeof Button> = {
  title: "Atoms/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "radio",
      options: ["primary", "secondary", "ghost", "danger"] satisfies ButtonVariant[],
      description: "Énfasis visual del botón",
    },
    size: {
      control: "radio",
      options: ["sm", "md", "lg"] satisfies ButtonSize[],
      description: "Tamaño del botón",
    },
    isLoading: { control: "boolean" },
    disabled: { control: "boolean" },
    onClick: { action: "clicked" },
  },
  args: {
    children: "Guardar cambios",
    variant: "primary",
    size: "md",
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Secondary: Story = {
  args: { variant: "secondary" },
};

export const Ghost: Story = {
  args: { variant: "ghost" },
};

export const Danger: Story = {
  args: { variant: "danger", children: "Eliminar alumno" },
};

export const Small: Story = {
  args: { size: "sm" },
};

export const Large: Story = {
  args: { size: "lg" },
};

export const Loading: Story = {
  args: { isLoading: true, children: "Guardando…" },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const WithIcons: Story = {
  args: {
    leadingIcon: <span aria-hidden="true">←</span>,
    trailingIcon: <span aria-hidden="true">→</span>,
    children: "Continuar",
  },
};

export const AllVariants: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
      {(["primary", "secondary", "ghost", "danger"] as const).map((variant) => (
        <Button key={variant} {...args} variant={variant}>
          {variant}
        </Button>
      ))}
    </div>
  ),
};
