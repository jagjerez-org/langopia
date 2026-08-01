import { Command } from "@nestjs/cqrs";
import type { ImportRowResult } from "../../../domain/model/import-report.vo.js";

export type ImportStudentsPreviewResult = {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  rows: readonly ImportRowResult[];
};

export class ImportStudentsPreviewCommand extends Command<ImportStudentsPreviewResult> {
  constructor(readonly props: { csv: string }) {
    super();
  }
}
