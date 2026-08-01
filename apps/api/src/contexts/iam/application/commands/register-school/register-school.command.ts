import { Command } from "@nestjs/cqrs";

/**
 * Comando: una intención, en imperativo. Primitivos, no objetos de dominio
 * — los construye el controlador, que ya resolvió la sesión de Better Auth
 * y no conoce el dominio.
 */
export class RegisterSchoolCommand extends Command<{ schoolId: string; slug: string }> {
  constructor(
    readonly props: {
      slug: string;
      name: string;
      ownerAuthUserId: string;
      ownerEmail: string;
      ownerName: string;
    },
  ) {
    super();
  }
}
