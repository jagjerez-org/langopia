import { Inject, Injectable } from "@nestjs/common";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../shared/domain/ports/tenant-context.port.js";
import {
  ProvisionedRole,
  type MembershipProvisioningPort,
} from "../../domain/ports/membership-provisioning.port.js";
import {
  MEMBERSHIP_REPOSITORY,
  type MembershipRepository,
} from "../persistence/membership.repository.js";

/**
 * Capa anticorrupción hacia `iam`.
 *
 * No escribe SQL: delega en `MembershipRepository`, que es quien conoce las
 * tablas. Y no abre transacción propia — se ejecuta dentro del `uow.execute()`
 * del manejador que lo llamó, para que el alta del alumno y su membresía se
 * confirmen o se deshagan juntas.
 */
@Injectable()
export class IamMembershipProvisioningAdapter implements MembershipProvisioningPort {
  constructor(
    @Inject(MEMBERSHIP_REPOSITORY) private readonly memberships: MembershipRepository,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  provisionStudent(params: { name: string; email: string; locale: string | null }) {
    return this.provision(params, ProvisionedRole.Student);
  }

  provisionGuardian(params: { name: string; email: string; locale: string | null }) {
    return this.provision(params, ProvisionedRole.Guardian);
  }

  provisionTeacher(params: { name: string; email: string; locale: string | null }) {
    return this.provision(params, ProvisionedRole.Teacher);
  }

  /**
   * El usuario es global (la misma persona puede estar en dos escuelas) y la
   * membresía es por escuela y rol. El repositorio reactiva en vez de
   * duplicar: cubre el caso del tutor con dos hijos matriculados, una sola
   * membresía y dos vínculos en `guardians`.
   */
  private async provision(
    params: { name: string; email: string; locale: string | null },
    role: ProvisionedRole,
  ): Promise<string> {
    const userId = await this.memberships.upsertUser({
      email: params.email,
      name: params.name,
      locale: params.locale ?? "es-ES",
    });

    return this.memberships.upsertMembership({
      schoolId: this.tenant.schoolId(),
      userId,
      role,
      locale: params.locale,
    });
  }
}
