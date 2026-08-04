import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../../atoms/Button/Button.js";
import { ToastProvider } from "./Toast.js";
import { useToast } from "./toast-context.js";
import type { ToastVariant } from "./toast-context.js";

/** Panel de demostración: un botón por variante que dispara avisos reales. */
function PanelDeAvisos() {
  const { showToast } = useToast();
  const avisar = (variant: ToastVariant, title: string, description?: string) =>
    showToast({ variant, title, description });

  return (
    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
      <Button variant="secondary" size="sm" onClick={() => avisar("neutral", "Sesión programada para el martes")}>
        Neutral
      </Button>
      <Button variant="secondary" size="sm" onClick={() => avisar("success", "Cambios guardados")}>
        Éxito
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => avisar("warning", "Queda 1 plaza", "El grupo B2 de los martes está casi lleno.")}
      >
        Aviso
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => avisar("critical", "No se pudo guardar", "traceId: 4f8c2a1e-9b3d-4e7f")}
      >
        Crítico
      </Button>
    </div>
  );
}

const meta: Meta<typeof ToastProvider> = {
  title: "Molecules/Toast",
  component: ToastProvider,
  tags: ["autodocs"],
  args: {
    label: "Avisos",
    closeLabel: "Cerrar aviso",
    children: <PanelDeAvisos />,
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
