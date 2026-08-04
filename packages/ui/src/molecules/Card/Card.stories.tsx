import type { Meta, StoryObj } from "@storybook/react";
import { Card } from "./Card.js";
import { cardActions, cardImage, cardTags } from "../../fixtures/cards.js";

const meta: Meta<typeof Card> = {
  title: "Molecules/Card",
  component: Card,
  tags: ["autodocs"],
  args: {
    title: "Guía de estilo editorial",
    children: <p>Normas de voz, tono y formato para todos los documentos públicos.</p>,
    image: cardImage,
    tags: cardTags,
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ConAcciones: Story = {
  args: {
    actions: cardActions,
  },
};

export const Horizontal: Story = {
  args: {
    orientation: "horizontal",
    actions: cardActions,
  },
};

export const Clickable: Story = {
  args: {
    href: "/documentos/guia-de-estilo",
    actions: undefined,
  },
};

export const SoloTexto: Story = {
  args: {
    image: undefined,
    tags: undefined,
  },
};
