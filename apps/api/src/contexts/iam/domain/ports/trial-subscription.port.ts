/** Suscripción de prueba con la que nace toda escuela autoservicio. */
export interface TrialSubscriptionPort {
  start(props: {
    id: string;
    schoolId: string;
    planCode: string;
    startsAt: Date;
    endsAt: Date;
  }): Promise<void>;
}

export const TRIAL_SUBSCRIPTION = Symbol("TrialSubscriptionPort");
