import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { TeacherOccupancyView } from "@langopia/contracts";
import {
  SCHEDULING_READ_MODEL,
  type SchedulingReadModel,
} from "../../ports/scheduling-read-model.port.js";

// `TeacherOccupancyView` (con la señal ya calculada) vive en
// `@langopia/contracts`: es la forma exacta que devuelve
// `GET /scheduling/teacher-occupancy`, y el panel la tipa desde el mismo sitio.
export type { TeacherOccupancyView } from "@langopia/contracts";

export class GetTeacherOccupancyQuery extends Query<TeacherOccupancyView[]> {
  constructor(readonly props: { from: string; to: string }) {
    super();
  }
}

/** Por debajo de esto son horas pagadas que no se facturan. */
const UNDERUSED_BELOW = 0.6;
/** Por encima de esto el profesor no tiene aire para preparar clases. */
const OVERLOADED_ABOVE = 0.9;

@QueryHandler(GetTeacherOccupancyQuery)
export class GetTeacherOccupancyHandler implements IQueryHandler<GetTeacherOccupancyQuery> {
  constructor(
    @Inject(SCHEDULING_READ_MODEL) private readonly readModel: SchedulingReadModel,
  ) {}

  async execute(query: GetTeacherOccupancyQuery): Promise<TeacherOccupancyView[]> {
    const rows = await this.readModel.teacherOccupancyBetween({
      from: new Date(query.props.from),
      to: new Date(query.props.to),
    });

    return rows
      .map((row) => ({
        ...row,
        signal:
          row.occupancyRate >= OVERLOADED_ABOVE
            ? ("overloaded" as const)
            : row.occupancyRate < UNDERUSED_BELOW
              ? ("underused" as const)
              : ("healthy" as const),
      }))
      .sort((a, b) => b.occupancyRate - a.occupancyRate);
  }
}
