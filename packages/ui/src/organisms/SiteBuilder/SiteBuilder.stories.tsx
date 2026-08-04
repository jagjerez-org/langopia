import type { Meta, StoryObj } from "@storybook/react";
import {
  siteBuilderAvailableBlocks,
  siteBuilderInitialBlocks,
  siteBuilderLabels,
} from "../../fixtures/builders.js";
import { SiteBuilder } from "./SiteBuilder.js";

const meta = {
  title: "Organisms/SiteBuilder",
  component: SiteBuilder,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    availableBlocks: siteBuilderAvailableBlocks,
    labels: siteBuilderLabels,
  },
} satisfies Meta<typeof SiteBuilder>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    onChange: () => {},
    onSave: () => {},
    onPreview: () => {},
    onPublish: () => {},
  },
};

export const WithBlocks: Story = {
  args: {
    initialBlocks: siteBuilderInitialBlocks,
    onChange: () => {},
    onSave: () => {},
    onPreview: () => {},
    onPublish: () => {},
  },
};
