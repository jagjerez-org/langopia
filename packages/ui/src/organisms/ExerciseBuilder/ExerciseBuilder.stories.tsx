import type { Meta, StoryObj } from "@storybook/react";
import {
  exerciseBuilderLabels,
  exerciseInitial,
  exerciseTypeOptions,
} from "../../fixtures/builders.js";
import { ExerciseBuilder } from "./ExerciseBuilder.js";

const meta = {
  title: "Organisms/ExerciseBuilder",
  component: ExerciseBuilder,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    typeOptions: exerciseTypeOptions,
    labels: exerciseBuilderLabels,
  },
} satisfies Meta<typeof ExerciseBuilder>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    onChange: () => {},
    onSave: () => {},
  },
};

export const WithExercise: Story = {
  args: {
    initialExercise: exerciseInitial,
    onChange: () => {},
    onSave: () => {},
  },
};
