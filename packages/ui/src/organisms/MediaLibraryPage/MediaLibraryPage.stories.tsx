import type { Meta, StoryObj } from "@storybook/react";
import {
  mediaFileActions,
  mediaFiles,
  mediaLibraryPageLabels,
} from "../../fixtures/content.js";
import { MediaLibraryPage } from "./MediaLibraryPage.js";

const meta = {
  title: "Organisms/MediaLibraryPage",
  component: MediaLibraryPage,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    files: mediaFiles,
    actions: mediaFileActions,
    labels: mediaLibraryPageLabels,
    onFileAction: () => {},
    onUpload: () => {},
  },
} satisfies Meta<typeof MediaLibraryPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    files: [],
  },
};
