import type { Meta, StoryObj } from "@storybook/react";
import { CalendarDay } from "./CalendarDay.js";

const meta: Meta<typeof CalendarDay> = {
  title: "Atoms/CalendarDay",
  component: CalendarDay,
  tags: ["autodocs"],
  argTypes: {
    selected: { control: "boolean" },
    isToday: { control: "boolean" },
    disabled: { control: "boolean" },
    outsideMonth: { control: "boolean", description: "Día de otro mes en la rejilla" },
    eventCount: { control: { type: "number", min: 0, max: 8 }, description: "Puntos indicadores (máx. 3)" },
    dateLabel: { control: "text", description: "Nombre accesible completo, ya traducido" },
    onSelect: { action: "selected" },
  },
  args: {
    date: new Date(2026, 2, 12),
    dateLabel: "jueves 12 de marzo de 2026",
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Selected: Story = {
  args: { selected: true },
};

export const Today: Story = {
  args: { isToday: true },
};

export const TodaySelected: Story = {
  args: { isToday: true, selected: true },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const OutsideMonth: Story = {
  args: { outsideMonth: true },
};

export const WithEvents: Story = {
  args: { eventCount: 3 },
};

/** Semana de ejemplo con estados mezclados, como la verá la molécula de calendario. */
export const WeekStrip: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: "0.25rem" }}>
      {Array.from({ length: 7 }, (_, index) => (
        <CalendarDay
          key={index}
          {...args}
          date={new Date(2026, 2, 9 + index)}
          isToday={index === 3}
          selected={index === 5}
          disabled={index === 6}
          eventCount={index === 1 ? 2 : index === 3 ? 1 : 0}
          onSelect={() => {}}
        />
      ))}
    </div>
  ),
};
