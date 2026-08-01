import { describe, expect, it } from "vitest";
import { ImportReport, type ImportRowResult } from "./import-report.vo.js";

const FILA_VALIDA: ImportRowResult = {
  row: 2,
  status: "valid",
  data: {
    name: "Ana Pérez",
    email: "ana.perez@example.com",
    dateOfBirth: "1990-01-01",
    nativeLanguage: "es",
    targetLanguage: "en",
    currentLevel: "B1",
    guardian: null,
  },
};

const FILA_INVALIDA: ImportRowResult = {
  row: 3,
  status: "invalid",
  errors: [
    { code: "invalid_import_field", message: "El campo «nivel» no es válido.", details: { field: "nivel" } },
  ],
};

describe("ImportReport", () => {
  it("cuenta filas válidas e inválidas por separado", () => {
    const report = ImportReport.of([FILA_VALIDA, FILA_INVALIDA]);

    expect(report.totalRows).toBe(2);
    expect(report.validCount).toBe(1);
    expect(report.invalidCount).toBe(1);
  });

  it("expone las filas válidas y las inválidas ya filtradas", () => {
    const report = ImportReport.of([FILA_VALIDA, FILA_INVALIDA]);

    expect(report.validRows).toHaveLength(1);
    expect(report.validRows[0]!.row).toBe(2);
    expect(report.invalidRows).toHaveLength(1);
    expect(report.invalidRows[0]!.row).toBe(3);
  });

  it("un informe vacío no tiene filas de ningún tipo", () => {
    const report = ImportReport.of([]);

    expect(report.totalRows).toBe(0);
    expect(report.validCount).toBe(0);
    expect(report.invalidCount).toBe(0);
  });

  it("conserva el orden original de las filas", () => {
    const report = ImportReport.of([FILA_INVALIDA, FILA_VALIDA]);

    expect(report.rows.map((r) => r.row)).toEqual([3, 2]);
  });
});
