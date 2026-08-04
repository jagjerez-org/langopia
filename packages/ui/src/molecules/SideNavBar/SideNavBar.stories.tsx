import type { Meta, StoryObj } from "@storybook/react";
import { IconInbox } from "../../atoms/Icons/Icons.js";
import { UserAvatar } from "../../atoms/UserAvatar/UserAvatar.js";
import { SideNavBar } from "./SideNavBar.js";

const items = [
  { href: "/inicio", label: "Inicio", icon: <IconInbox /> },
  { href: "/alumnos", label: "Alumnos", icon: <IconInbox />, active: true },
  { href: "/clases", label: "Clases", icon: <IconInbox /> },
  { href: "/pagos", label: "Pagos", icon: <IconInbox /> },
];

const meta: Meta<typeof SideNavBar> = {
  title: "Molecules/SideNavBar",
  component: SideNavBar,
  tags: ["autodocs"],
  argTypes: {
    onToggleCollapse: { action: "toggle-collapse" },
    collapsed: { control: "boolean" },
  },
  args: {
    items,
    ariaLabel: "Navegación principal",
    header: <span className="font-sans font-semibold text-text">Langopia</span>,
  },
  decorators: [
    (Story) => (
      <div className="h-96">
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Collapsed: Story = {
  args: { collapsed: true },
};

export const WithToggle: Story = {
  args: {
    onToggleCollapse: () => {},
    toggleLabel: "Alternar navegación",
  },
};

export const WithFooter: Story = {
  args: {
    footer: (
      <span className="flex items-center gap-2 px-1">
        <UserAvatar name="Ana García" size="sm" />
        <span className="text-[length:var(--ink-text-sm)] text-text">Ana García</span>
      </span>
    ),
  },
};
