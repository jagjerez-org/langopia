import type { Meta, StoryObj } from "@storybook/react";
import { LoginForm } from "./LoginForm.js";

const meta: Meta<typeof LoginForm> = {
  title: "Molecules/LoginForm",
  component: LoginForm,
  tags: ["autodocs"],
  argTypes: {
    onSubmit: { action: "submitted" },
    error: { control: "text" },
    isLoading: { control: "boolean" },
    minPasswordLength: { control: "number" },
    forgotPasswordHref: { control: "text" },
  },
  args: {
    forgotPasswordHref: "/recuperar-contrasena",
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithServerError: Story = {
  args: { error: "Credenciales incorrectas. Revisa el correo y la contraseña." },
};

export const Loading: Story = {
  args: { isLoading: true },
};

export const RejectingSubmit: Story = {
  args: {
    onSubmit: async () => {
      throw new Error("El servidor no responde. Inténtalo más tarde.");
    },
  },
};

export const CustomLabels: Story = {
  args: {
    emailLabel: "Usuario",
    passwordLabel: "Clave de acceso",
    submitLabel: "Acceder al campus",
    minPasswordLength: 12,
    passwordErrorMessage: "La clave debe tener al menos 12 caracteres.",
  },
};
