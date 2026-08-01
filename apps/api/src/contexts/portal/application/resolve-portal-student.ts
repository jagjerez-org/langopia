import { NotFoundError } from "../../shared/domain/errors/domain-error.js";
import { PortalAccessDeniedError } from "../domain/errors/portal.errors.js";
import type { PortalReadModel } from "./ports/portal-read-model.port.js";

/**
 * Resuelve a qué alumno se refieren los tres endpoints `/portal/me/*`.
 *
 * Sin `requestedStudentId`: el alumno propio de esta membresía (ella misma, o
 * su primer tutelado si es un tutor). Puede no haber ninguno —devuelve
 * `null`, y el manejador responde con listas vacías, no con un error—.
 *
 * Con `requestedStudentId` (un tutor con varios hijos eligiendo cuál, o el
 * intento de ver el de otro): se comprueba la propiedad de verdad.
 * `not_found` es RLS diciendo que esa fila no existe para esta escuela — 404.
 * `denied` es que existe pero no es tuya — 403, la fuga que este paso
 * concreto tiene que impedir.
 */
export async function resolvePortalStudentId(
  readModel: PortalReadModel,
  membershipId: string,
  requestedStudentId?: string,
): Promise<string | null> {
  if (!requestedStudentId) return readModel.ownStudentId(membershipId);

  const access = await readModel.studentAccess(requestedStudentId, membershipId);
  if (access.kind === "not_found") throw new NotFoundError("el alumno", requestedStudentId);
  if (access.kind === "denied") throw new PortalAccessDeniedError(requestedStudentId);
  return access.studentId;
}
