import type { Meta, StoryObj } from "@storybook/react";
import {
  professorActions,
  professorCreateFields,
  professors,
  professorsPageLabels,
} from "../../fixtures/people.js";
import { ProfessorsPage } from "./ProfessorsPage.js";

const meta = {
  title: "Organisms/ProfessorsPage",
  component: ProfessorsPage,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    professors,
    createFields: professorCreateFields,
    actions: professorActions,
    labels: professorsPageLabels,
    onAddProfessor: () => {},
    onProfessorAction: () => {},
  },
} satisfies Meta<typeof ProfessorsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    professors: [],
  },
};
