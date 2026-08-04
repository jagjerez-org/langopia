import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../../atoms/Button/Button.js";
import { Dialog } from "./Dialog.js";

const meta: Meta<typeof Dialog> = {
  title: "Molecules/Dialog",
  component: Dialog,
  tags: ["autodocs"],
  args: {
    title: "Dar de baja a Ana García",
    description: "La alumna dejará de aparecer en la lista del grupo B2.",
    closeLabel: "Cerrar diálogo",
    children: <p>Esta acción no se puede deshacer.</p>,
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

/** Envoltorio con estado: quien usa `Dialog` posee `open` y lo cierra en `onClose`. */
function DialogDemo(args: Partial<Parameters<typeof Dialog>[0]>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Abrir diálogo</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={args.title ?? ""}
        description={args.description}
        closeLabel={args.closeLabel ?? "Cerrar"}
        dismissible={args.dismissible}
        footer={args.footer}
      >
        {args.children}
      </Dialog>
    </>
  );
}

export const Default: Story = {
  render: (args) => (
    <DialogDemo
      {...args}
      footer={
        <>
          <Button variant="secondary">Cancelar</Button>
          <Button variant="danger">Confirmar baja</Button>
        </>
      }
    />
  ),
};

export const NoDescartable: Story = {
  render: (args) => (
    <DialogDemo
      {...args}
      dismissible={false}
      title="Publicando la unidad…"
      description="Este diálogo no se cierra con Escape ni clicando fuera."
      footer={<Button isLoading>Publicando…</Button>}
    />
  ),
};

export const SinPie: Story = {
  render: (args) => <DialogDemo {...args} description={undefined} />,
};
