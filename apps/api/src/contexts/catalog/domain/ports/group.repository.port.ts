import type { Group } from "../model/group.aggregate.js";
import type { GroupId } from "../model/identifiers.js";

export interface GroupRepository {
  find(id: GroupId): Promise<Group | null>;

  /** Como `find`, pero lanza `NotFoundError` si no existe. */
  findOrFail(id: GroupId): Promise<Group>;

  save(group: Group): Promise<void>;
}

export const GROUP_REPOSITORY = Symbol("GroupRepository");
