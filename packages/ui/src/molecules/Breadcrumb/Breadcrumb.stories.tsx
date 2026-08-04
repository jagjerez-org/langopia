import type { Meta, StoryObj } from "@storybook/react";
import { IconChevronRight } from "../../atoms/Icons/Icons.js";
import { Breadcrumb } from "./Breadcrumb.js";

const meta: Meta<typeof Breadcrumb> = {
  title: "Molecules/Breadcrumb",
  component: Breadcrumb,
  tags: ["autodocs"],
  argTypes: {
    maxItems: { control: "number" },
  },
  args: {
    ariaLabel: "Migas de pan",
    items: [
      { label: "Inicio", href: "/" },
      { label: "Alumnos", href: "/alumnos" },
      { label: "Ana García" },
    ],
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CustomSeparator: Story = {
  args: { separator: <IconChevronRight /> },
};

export const Collapsed: Story = {
  args: {
    maxItems: 3,
    items: [
      { label: "Inicio", href: "/" },
      { label: "Academia", href: "/academia" },
      { label: "Cursos", href: "/cursos" },
      { label: "Alumnos", href: "/alumnos" },
      { label: "Ana García" },
    ],
  },
};

export const SingleLevel: Story = {
  args: {
    items: [{ label: "Inicio" }],
  },
};
