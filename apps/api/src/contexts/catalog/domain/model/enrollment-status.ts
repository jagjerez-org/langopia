export const EnrollmentStatus = {
  Active: "active",
  Completed: "completed",
  Withdrawn: "withdrawn",
  Transferred: "transferred", // se movió a otro grupo
} as const;

export type EnrollmentStatus = (typeof EnrollmentStatus)[keyof typeof EnrollmentStatus];
