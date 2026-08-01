export const SessionStatus = {
  Scheduled: "scheduled",
  InProgress: "in_progress",
  Completed: "completed",
  CanceledBySchool: "canceled_by_school",
  CanceledByStudent: "canceled_by_student",
  Rescheduled: "rescheduled", // esta instancia se sustituyó por otra
  NoShow: "no_show", // nadie se conectó
} as const;

export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

/** Quién cancela cambia si procede devolución, así que es del dominio. */
export const CancelingParty = {
  School: "school",
  Student: "student",
} as const;

export type CancelingParty = (typeof CancelingParty)[keyof typeof CancelingParty];
