import type { Meta, StoryObj } from "@storybook/react";
import {
  planningCreateFields,
  planningPageLabels,
  planningSessionActions,
  planningSessions,
} from "../../fixtures/management.js";
import { PlanningPage } from "./PlanningPage.js";

const meta = {
  title: "Organisms/PlanningPage",
  component: PlanningPage,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    sessions: planningSessions,
    createFields: planningCreateFields,
    sessionActions: planningSessionActions,
    labels: planningPageLabels,
    onSelectDate: () => {},
    onCreateEvent: () => {},
    onEventAction: () => {},
  },
} satisfies Meta<typeof PlanningPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    sessions: [],
  },
};
