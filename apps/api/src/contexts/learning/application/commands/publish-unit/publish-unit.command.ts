import { Command } from "@nestjs/cqrs";

/**
 * Publica una unidad ya generada (o subida). Es la frontera donde una
 * persona —quien llama a este comando, vía `TenantContext.membershipId()`—
 * se hace responsable de lo que ve el alumno («la IA propone, el profesor
 * firma»): `ContentUnit.publish()` exige un revisor de carne y hueso, nunca
 * el sistema.
 *
 * `groupIds` (tarea 11 del panel, Paso 4: «publicar a grupos, con selector
 * múltiple») elige a QUIÉN llega. Todos tienen que ser del mismo curso —una
 * unidad se asocia a uno solo—, y ese curso tiene que ser del nivel de la
 * unidad. Sin grupos, la unidad se publica igual pero no llega todavía a
 * ninguno: publicar y repartir son dos decisiones distintas.
 */
export class PublishUnitCommand extends Command<{
  contentUnitId: string;
  status: string;
  courseId: string | null;
  groupIds: string[];
}> {
  constructor(readonly props: { contentUnitId: string; groupIds?: string[] }) {
    super();
  }
}
