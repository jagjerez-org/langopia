import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Button } from "../../atoms/Button/Button.js";
import { CookiesRgpd } from "./CookiesRgpd.js";

const meta: Meta<typeof CookiesRgpd> = {
  title: "Molecules/CookiesRgpd",
  component: CookiesRgpd,
  tags: ["autodocs"],
  argTypes: {
    visible: { control: "boolean" },
  },
  args: {
    title: "Usamos cookies",
    description:
      "Utilizamos cookies propias y de terceros para analizar el uso del panel y mejorar tu experiencia.",
    acceptLabel: "Aceptar todas",
    rejectLabel: "Rechazar",
    onAccept: () => {},
    onReject: () => {},
    visible: true,
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithPolicyLink: Story = {
  args: {
    description: (
      <>
        Utilizamos cookies propias y de terceros. Consulta nuestra{" "}
        <a href="/legal/cookies">política de cookies</a> para más detalle.
      </>
    ),
  },
};

export const WithConfigure: Story = {
  args: {
    configureLabel: "Configurar",
    onConfigure: () => {},
  },
};

export const Hidden: Story = {
  args: { visible: false },
};

/**
 * Flujo completo: la app controla `visible`; al aceptar o rechazar, el padre
 * oculta el banner (aquí, con estado local de la historia).
 */
export const ControlledFlow: Story = {
  render: () => {
    const [visible, setVisible] = useState(true);
    return (
      <div className="flex min-h-40 flex-col items-start gap-4">
        {!visible && (
          <Button variant="secondary" size="sm" onClick={() => setVisible(true)}>
            Mostrar el aviso de nuevo
          </Button>
        )}
        <CookiesRgpd
          title="Usamos cookies"
          description="Utilizamos cookies propias y de terceros para analizar el uso del panel."
          acceptLabel="Aceptar todas"
          rejectLabel="Rechazar"
          visible={visible}
          onAccept={() => setVisible(false)}
          onReject={() => setVisible(false)}
        />
      </div>
    );
  },
};
