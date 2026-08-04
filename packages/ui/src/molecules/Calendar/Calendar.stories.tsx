import type { Meta, StoryObj } from "@storybook/react";
import { Calendar } from "./Calendar.js";
import { calendarEvents } from "../../fixtures/calendar.js";

const meta: Meta<typeof Calendar> = {
  title: "Molecules/Calendar",
  component: Calendar,
  tags: ["autodocs"],
  args: {
    events: calendarEvents,
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const VistaMes: Story = {};

export const VistaSemana: Story = {
  args: {
    defaultView: "week",
  },
};

export const VistaDia: Story = {
  args: {
    defaultView: "day",
  },
};

export const VistaAno: Story = {
  args: {
    defaultView: "year",
  },
};

export const EnIngles: Story = {
  args: {
    locale: "en",
    previousLabel: "Previous",
    nextLabel: "Next",
    todayLabel: "Today",
    viewGroupLabel: "Calendar view",
    viewLabels: { day: "Day", week: "Week", month: "Month", year: "Year" },
    kindLabels: { event: "Event", reminder: "Reminder", task: "Task" },
    emptyEventsLabel: "No events",
    goToMonthLabel: (monthName: string, year: number) => `Go to ${monthName} ${year}`,
  },
};

export const SemanaEmpiezaEnDomingo: Story = {
  args: {
    firstDayOfWeek: 0,
  },
};

export const FinesDeSemanaDeshabilitados: Story = {
  args: {
    isDateDisabled: (date: Date) => date.getDay() === 0 || date.getDay() === 6,
  },
};

export const SinEventos: Story = {
  args: {
    events: [],
    defaultView: "day",
  },
};
