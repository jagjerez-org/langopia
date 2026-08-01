import { Command } from "@nestjs/cqrs";
import type { ImportRowError } from "../../../domain/model/import-report.vo.js";

export type ImportCommitRowResult =
  | { row: number; status: "created"; studentId: string }
  | { row: number; status: "updated"; studentId: string }
  | { row: number; status: "invalid"; errors: readonly ImportRowError[] };

export type ImportStudentsCommitResult = {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  createdCount: number;
  updatedCount: number;
  rows: ImportCommitRowResult[];
};

export class ImportStudentsCommitCommand extends Command<ImportStudentsCommitResult> {
  constructor(readonly props: { csv: string }) {
    super();
  }
}
