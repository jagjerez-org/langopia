import type { Meta, StoryObj } from "@storybook/react";
import { LeadForm } from "./LeadForm.js";

const meta: Meta<typeof LeadForm> = {
  title: "Molecules/LeadForm",
  component: LeadForm,
  tags: ["autodocs"],
  argTypes: {
    onSubmit: { action: "submitted" },
    error: { control: "text" },
    isLoading: { control: "boolean" },
  },
  args: {
    consentLabel: (
      <span>
        He leído y acepto la{" "}
        <a href="/politica-de-privacidad" className="text-accent underline">
          política de privacidad
        </a>
        .
      </span>
    ),
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithServerError: Story = {
  args: { error: "No se pudo registrar tu solicitud. Inténtalo más tarde." },
};

export const Loading: Story = {
  args: { isLoading: true },
};

export const RejectingSubmit: Story = {
  args: {
    onSubmit: async () => {
      throw new Error("El servicio de contacto no está disponible.");
    },
  },
};
