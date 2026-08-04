import type { Meta, StoryObj } from "@storybook/react";
import {
  studentActions,
  studentCreateFields,
  studentPageLabels,
  students,
} from "../../fixtures/people.js";
import { StudentPage } from "./StudentPage.js";

const meta = {
  title: "Organisms/StudentPage",
  component: StudentPage,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    students,
    createFields: studentCreateFields,
    actions: studentActions,
    labels: studentPageLabels,
    pageSize: 5,
    onAddStudent: () => {},
    onStudentAction: () => {},
  },
} satisfies Meta<typeof StudentPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    students: [],
  },
};
