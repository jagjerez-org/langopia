import type { PinoLogger } from "nestjs-pino";
import type { UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import {
  NoGuardianForMinorError,
  resolveMembershipRecipient,
  resolveStudentRecipient,
} from "../../domain/model/recipient-resolver.js";
import type { Recipient } from "../../domain/model/recipient.js";
import type { PeopleDirectoryPort } from "../../domain/ports/people-directory.port.js";

/**
 * A quién escribir sobre una factura: el contacto de facturación si lo hay
 * (`billToMembershipId`, ya resuelto por quien emitió la factura), y si no,
 * el propio alumno o su tutor (`resolveStudentRecipient`, que aplica la
 * regla del menor).
 *
 * Compartida entre `OnInvoiceIssued` y `OnPaymentFailed`: los dos avisos de
 * facturación escriben a exactamente la misma persona, y duplicar esta regla
 * en dos ficheros es la forma en que un mañana solo se actualiza en uno.
 * Registra el motivo por el que no se pudo resolver y devuelve `null` en vez
 * de lanzar: quien llama decide simplemente no enviar el correo.
 */
export async function resolveInvoicePayerRecipient(params: {
  uow: UnitOfWork;
  people: PeopleDirectoryPort;
  logger: PinoLogger;
  billToMembershipId: string | null;
  studentId: string | null;
  invoiceId: string;
  noRecipientReason: string;
}): Promise<Recipient | null> {
  const { uow, people, logger, billToMembershipId, studentId, invoiceId, noRecipientReason } = params;

  if (billToMembershipId) {
    const candidate = await uow.read(() => people.findMembershipRecipient(billToMembershipId));
    if (!candidate) {
      logger.error(`Factura ${invoiceId}: la membresía que paga no existe. ${noRecipientReason}`);
      return null;
    }
    return resolveMembershipRecipient(candidate);
  }

  if (!studentId) {
    logger.error(`Factura ${invoiceId}: ni contacto de facturación ni alumno. ${noRecipientReason}`);
    return null;
  }

  const context = await uow.read(() => people.findStudentRecipientContext(studentId));
  if (!context) {
    logger.error(`Factura ${invoiceId}: el alumno ${studentId} no tiene ficha. ${noRecipientReason}`);
    return null;
  }

  try {
    return resolveStudentRecipient({
      studentId,
      isMinor: context.isMinor,
      student: context.student,
      guardians: context.guardians,
    });
  } catch (error) {
    if (error instanceof NoGuardianForMinorError) {
      logger.error(`Factura ${invoiceId}: ${error.message}`);
      return null;
    }
    throw error;
  }
}
