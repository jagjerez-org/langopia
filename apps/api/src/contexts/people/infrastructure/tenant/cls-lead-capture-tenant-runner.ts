import { Injectable } from "@nestjs/common";
import { ClsService } from "nestjs-cls";
import type { LeadCaptureTenantRunner } from "../../application/ports/lead-capture-tenant-runner.port.js";
import { CLS_SCHOOL_ID } from "../../../shared/infrastructure/tenant/cls-tenant-context.js";

@Injectable()
export class ClsLeadCaptureTenantRunner implements LeadCaptureTenantRunner {
  constructor(private readonly cls: ClsService) {}

  runWithSchool<T>(schoolId: string, work: () => Promise<T>): Promise<T> {
    return this.cls.runWith({ ...this.cls.get(), [CLS_SCHOOL_ID]: schoolId }, work);
  }
}
