export const SYSTEM_TENANT_RUNNER = Symbol("SystemTenantRunner");

export interface SystemTenantRunner {
  runWithSchool<T>(schoolId: string, work: () => Promise<T>): Promise<T>;
}
