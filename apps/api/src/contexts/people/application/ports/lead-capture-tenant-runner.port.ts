export const LEAD_CAPTURE_TENANT_RUNNER = Symbol("LeadCaptureTenantRunner");

export interface LeadCaptureTenantRunner {
  runWithSchool<T>(schoolId: string, work: () => Promise<T>): Promise<T>;
}
