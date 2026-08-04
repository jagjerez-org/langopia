import type { Meta, StoryObj } from "@storybook/react";
import { ThemeToggle } from "../../atoms/ThemeToggle/ThemeToggle.js";
import { TreeDots } from "../../atoms/TreeDots/TreeDots.js";
import { ItemList } from "../../atoms/ItemList/ItemList.js";
import { UserAvatar } from "../../atoms/UserAvatar/UserAvatar.js";
import { TopNavBar } from "./TopNavBar.js";

const meta: Meta<typeof TopNavBar> = {
  title: "Molecules/TopNavBar",
  component: TopNavBar,
  tags: ["autodocs"],
  argTypes: {
    sticky: { control: "boolean" },
  },
  args: {
    title: "Alumnos",
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithBreadcrumb: Story = {
  args: {
    title: "Ana García",
    breadcrumb: (
      <nav aria-label="Migas de pan" className="text-[length:var(--ink-text-sm)] text-muted">
        Alumnos / Ana García
      </nav>
    ),
  },
};

export const WithActions: Story = {
  args: {
    actions: (
      <>
        <ThemeToggle
          value="light"
          onChange={() => {}}
          labels={{ light: "Claro", dark: "Oscuro" }}
        />
        <UserAvatar name="Ana García" size="sm" />
        <TreeDots triggerLabel="Más acciones">
          <ItemList onClick={() => {}}>Editar</ItemList>
          <ItemList onClick={() => {}}>Archivar</ItemList>
        </TreeDots>
      </>
    ),
  },
};

export const Sticky: Story = {
  args: { sticky: true },
};
