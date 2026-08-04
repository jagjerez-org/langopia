import type { Meta, StoryObj } from "@storybook/react";
import {
  elearningCourses,
  elearningLessonActions,
  elearningPageLabels,
} from "../../fixtures/content.js";
import { ElearningPage } from "./ElearningPage.js";

const meta = {
  title: "Organisms/ElearningPage",
  component: ElearningPage,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    courses: elearningCourses,
    lessonActions: elearningLessonActions,
    labels: elearningPageLabels,
    onOpenCourse: () => {},
    onLessonAction: () => {},
  },
} satisfies Meta<typeof ElearningPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    courses: [],
  },
};
