import type { Meta, StoryObj } from "@storybook/react";
import { landingContent } from "../../fixtures/landing.js";
import { LandingPage } from "./LandingPage.js";

const meta = {
  title: "Organisms/LandingPage",
  component: LandingPage,
  tags: ["autodocs"],
  parameters: {
    // Página completa: sin el padding por defecto del canvas.
    layout: "fullscreen",
  },
  args: landingContent,
} satisfies Meta<typeof LandingPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutPricing: Story = {
  args: {
    pricing: undefined,
  },
};

export const DarkMode: Story = {
  // Fuerza el global `theme` de la toolbar: el decorator del preview aplica
  // `data-theme="dark"` al <html> del iframe y theme.css hace el resto.
  globals: { theme: "dark" },
};

export const Mobile: Story = {
  parameters: {
    // Viewport de móvil: las rejillas caen a una columna.
    viewport: { defaultViewport: "mobile1" },
  },
};
