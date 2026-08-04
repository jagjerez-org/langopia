import type { Meta, StoryObj } from "@storybook/react";
import type { ComponentType } from "react";
import { UserComponent } from "./UserComponent.js";
import type { UserComponentBaseProps } from "./UserComponent.js";

// Args "planos" solo para las stories: la unión discriminada de
// UserComponentProps colapsa a `never` al pasar por la inferencia de
// StoryObj/Meta. El cast del componente es seguro: cada combinación válida de
// args encaja en la unión.
type StoryArgs = UserComponentBaseProps & {
  href?: string;
  onClick?: () => void;
};

const meta = {
  title: "Molecules/UserComponent",
  component: UserComponent as ComponentType<StoryArgs>,
  tags: ["autodocs"],
  argTypes: {
    size: { control: "radio", options: ["sm", "md", "lg"] },
    collapsed: { control: "boolean" },
  },
  args: {
    name: "María López",
    role: "Administradora",
  },
} satisfies Meta<StoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithEmail: Story = {
  args: { role: undefined, email: "maria@langopia.com" },
};

export const WithAvatarImage: Story = {
  args: {
    avatarUrl: "https://i.pravatar.cc/96?u=maria",
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-4">
      <UserComponent name="María López" role="Administradora" size="sm" />
      <UserComponent name="María López" role="Administradora" size="md" />
      <UserComponent name="María López" role="Administradora" size="lg" />
    </div>
  ),
};

export const Collapsed: Story = {
  args: { collapsed: true },
};

export const AsLink: Story = {
  args: { href: "/perfil" },
};

export const AsButton: Story = {
  args: { onClick: () => {} },
};

export const CollapsedButton: Story = {
  args: { collapsed: true, onClick: () => {} },
};
