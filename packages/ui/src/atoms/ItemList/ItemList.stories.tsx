import type { Meta, StoryObj } from "@storybook/react";
import { ItemList } from "./ItemList.js";
import { IconChevronRight, IconInbox } from "../Icons/Icons.js";
import { UserAvatar } from "../UserAvatar/UserAvatar.js";

const meta: Meta<typeof ItemList> = {
  title: "Atoms/ItemList",
  component: ItemList,
  tags: ["autodocs"],
  argTypes: {
    href: { control: "text", description: "Con href la fila es un enlace" },
    active: { control: "boolean" },
    disabled: { control: "boolean", description: "Solo en la variante botón" },
    onClick: { action: "clicked" },
  },
  args: {
    children: "Grupo B2 mañanas",
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Static: Story = {};

export const AsLink: Story = {
  args: { href: "#grupos/b2" },
};

export const AsButton: Story = {
  args: { onClick: () => {} },
};

export const Active: Story = {
  args: { href: "#grupos/b2", active: true },
};

export const Disabled: Story = {
  args: { onClick: () => {}, disabled: true },
};

export const WithAccessory: Story = {
  args: { href: "#grupos/b2", accessory: <IconChevronRight /> },
};

export const WithLeading: Story = {
  args: { href: "#grupos/b2", leading: <UserAvatar name="Andrea Gil" size="sm" /> },
};

/** Lista de ejemplo tal como la compondrá la molécula. */
export const ListExample: Story = {
  render: (args) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem", width: "18rem" }}>
      <ItemList {...args} leading={<IconInbox />} accessory={<IconChevronRight />} href="#a" active>
        Grupo B2 mañanas
      </ItemList>
      <ItemList {...args} leading={<IconInbox />} accessory={<IconChevronRight />} href="#b" active={false}>
        Grupo C1 tardes
      </ItemList>
      <ItemList {...args} leading={<IconInbox />} accessory={<IconChevronRight />} href="#c" active={false}>
        Grupo A2 intensivo
      </ItemList>
    </div>
  ),
};
