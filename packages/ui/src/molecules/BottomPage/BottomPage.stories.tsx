import type { Meta, StoryObj } from "@storybook/react";
import { IconInbox } from "../../atoms/Icons/Icons.js";
import { BottomPage } from "./BottomPage.js";

const meta: Meta<typeof BottomPage> = {
  title: "Molecules/BottomPage",
  component: BottomPage,
  tags: ["autodocs"],
  args: {
    ariaLabel: "Acciones de página",
    items: [
      { href: "/inicio", label: "Inicio", icon: <IconInbox />, active: true },
      { href: "/alumnos", label: "Alumnos", icon: <IconInbox /> },
      { href: "/perfil", label: "Perfil", icon: <IconInbox /> },
    ],
  },
  parameters: {
    // La barra es `fixed`: en docs queda mejor sin el marco con relleno.
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SingleAction: Story = {
  args: {
    items: [{ href: "/guardar", label: "Guardar", icon: <IconInbox /> }],
  },
};

export const WithoutActive: Story = {
  args: {
    items: [
      { href: "/inicio", label: "Inicio", icon: <IconInbox /> },
      { href: "/alumnos", label: "Alumnos", icon: <IconInbox /> },
    ],
  },
};
