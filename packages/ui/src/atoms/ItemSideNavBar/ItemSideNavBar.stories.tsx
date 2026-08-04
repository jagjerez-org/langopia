import type { Meta, StoryObj } from "@storybook/react";
import { ItemSideNavBar } from "./ItemSideNavBar.js";
import { IconCheckCircle, IconDot, IconInbox } from "../Icons/Icons.js";

const meta: Meta<typeof ItemSideNavBar> = {
  title: "Atoms/ItemSideNavBar",
  component: ItemSideNavBar,
  tags: ["autodocs"],
  argTypes: {
    label: { control: "text" },
    href: { control: "text" },
    active: { control: "boolean", description: 'Página actual: aria-current="page"' },
    collapsed: { control: "boolean", description: "Solo icono; etiqueta accesible" },
  },
  args: {
    icon: <IconInbox />,
    label: "Alumnos",
    href: "#alumnos",
    active: false,
    collapsed: false,
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Active: Story = {
  args: { active: true },
};

export const Collapsed: Story = {
  args: { collapsed: true },
};

export const CollapsedActive: Story = {
  args: { collapsed: true, active: true },
};

export const NavGroup: Story = {
  render: (args) => (
    <nav style={{ display: "flex", flexDirection: "column", gap: "0.25rem", width: "13rem" }}>
      <ItemSideNavBar {...args} icon={<IconInbox />} label="Alumnos" href="#alumnos" active />
      <ItemSideNavBar {...args} icon={<IconCheckCircle />} label="Asistencia" href="#asistencia" active={false} />
      <ItemSideNavBar {...args} icon={<IconDot />} label="Informes" href="#informes" active={false} />
    </nav>
  ),
};

export const NavGroupCollapsed: Story = {
  render: (args) => (
    <nav style={{ display: "flex", flexDirection: "column", gap: "0.25rem", width: "3.5rem" }}>
      <ItemSideNavBar {...args} icon={<IconInbox />} label="Alumnos" href="#alumnos" active collapsed />
      <ItemSideNavBar {...args} icon={<IconCheckCircle />} label="Asistencia" href="#asistencia" active={false} collapsed />
      <ItemSideNavBar {...args} icon={<IconDot />} label="Informes" href="#informes" active={false} collapsed />
    </nav>
  ),
};
