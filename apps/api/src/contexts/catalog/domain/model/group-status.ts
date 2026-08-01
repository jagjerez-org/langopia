export const GroupStatus = {
  Planned: "planned",
  Running: "running",
  Finished: "finished",
  Canceled: "canceled",
} as const;

export type GroupStatus = (typeof GroupStatus)[keyof typeof GroupStatus];
