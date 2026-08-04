import type { Meta, StoryObj } from "@storybook/react";
import type { ComponentType } from "react";
import { IconInbox } from "../../atoms/Icons/Icons.js";
import { UserAvatar } from "../../atoms/UserAvatar/UserAvatar.js";
import { SideNavBar } from "./SideNavBar.js";
import type { SideNavBarBaseProps } from "./SideNavBar.js";

const items = [
  { href: "/inicio", label: "Inicio", icon: <IconInbox /> },
  { href: "/alumnos", label: "Alumnos", icon: <IconInbox />, active: true },
  { href: "/clases", label: "Clases", icon: <IconInbox /> },
  { href: "/pagos", label: "Pagos", icon: <IconInbox /> },
];

// Args "planos" solo para las stories: la unión discriminada de SideNavBarProps
// colapsa a `never` al pasar por la inferencia de StoryObj/Meta. El cast del
// componente es seguro: cada combinación válida de args encaja en la unión.
type StoryArgs = SideNavBarBaseProps & {
  onToggleCollapse?: () => void;
  toggleLabel?: string;
};

const meta = {
  title: "Molecules/SideNavBar",
  component: SideNavBar as ComponentType<StoryArgs>,
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
} satisfies Meta<StoryArgs>;

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
