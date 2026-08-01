import { describe, expect, it } from "vitest";
import { analyzeStudentsCsv } from "./analyze-students-csv.js";

const AHORA = new Date("2026-07-27T12:00:00Z");

const CABECERA =
  "nombre,email,fecha_nacimiento,idioma_nativo,idioma_objetivo,nivel,tutor_nombre,tutor_email,tutor_parentesco";

describe("analyzeStudentsCsv (Tarea 14)", () => {
  it("una fila con todos los datos correctos sale válida", () => {
    const csv = `${CABECERA}\nAna Pérez,ana@example.com,1990-01-01,es,en,B1,,,`;
    const report = analyzeStudentsCsv(csv, AHORA);

    expect(report.totalRows).toBe(1);
    expect(report.validCount).toBe(1);
    expect(report.invalidCount).toBe(0);
    const [row] = report.validRows;
    expect(row!.data).toEqual({
      name: "Ana Pérez",
      email: "ana@example.com",
      dateOfBirth: "1990-01-01",
      nativeLanguage: "es",
      targetLanguage: "en",
      currentLevel: "B1",
      guardian: null,
    });
  });

  it("una fila sin nivel MCER también es válida: el nivel es opcional", () => {
    const csv = `${CABECERA}\nAna Pérez,ana@example.com,1990-01-01,es,en,,,,`;
    const report = analyzeStudentsCsv(csv, AHORA);

    expect(report.validCount).toBe(1);
    expect(report.validRows[0]!.data.currentLevel).toBeNull();
  });

  it("un menor sin columnas de tutor es un error de fila, no un aborto de la importación", () => {
    const csv =
      `${CABECERA}\n` +
      `Ana Pérez,ana@example.com,1990-01-01,es,en,B1,,,\n` +
      `Iker Niño,iker@example.com,2015-01-01,es,en,,,,\n`;
    const report = analyzeStudentsCsv(csv, AHORA);

    expect(report.totalRows).toBe(2);
    expect(report.validCount).toBe(1);
    expect(report.invalidCount).toBe(1);
    const filaMala = report.invalidRows.find((r) => r.row === 3)!;
    expect(filaMala.errors.some((e) => e.code === "guardian_required")).toBe(true);
    // La fila buena sigue entrando.
    expect(report.validRows[0]!.data.email).toBe("ana@example.com");
  });

  it("un menor con tutor completo sale válido con los datos del tutor", () => {
    const csv =
      `${CABECERA}\n` +
      "Iker Niño,iker@example.com,2015-01-01,es,en,,María Niño,maria@example.com,mother";
    const report = analyzeStudentsCsv(csv, AHORA);

    expect(report.validCount).toBe(1);
    expect(report.validRows[0]!.data.guardian).toEqual({
      name: "María Niño",
      email: "maria@example.com",
      relationship: "mother",
    });
  });

  it("un correo que se repite en dos filas del fichero es un error en AMBAS filas", () => {
    const csv =
      `${CABECERA}\n` +
      "Ana Pérez,ana@example.com,1990-01-01,es,en,B1,,,\n" +
      "Ana Otra,ana@example.com,1991-01-01,es,en,B2,,,";
    const report = analyzeStudentsCsv(csv, AHORA);

    expect(report.validCount).toBe(0);
    expect(report.invalidCount).toBe(2);
    for (const row of report.invalidRows) {
      expect(row.errors.some((e) => e.code === "duplicate_email_in_import")).toBe(true);
    }
  });

  it("una fecha de nacimiento mal formada es un error de fila con el código de dominio existente", () => {
    const csv = `${CABECERA}\nAna Pérez,ana@example.com,31-01-1990,es,en,B1,,,`;
    const report = analyzeStudentsCsv(csv, AHORA);

    expect(report.invalidCount).toBe(1);
    expect(report.invalidRows[0]!.errors.some((e) => e.code === "invalid_date_of_birth")).toBe(true);
  });

  it("un nivel MCER inventado es un error de fila", () => {
    const csv = `${CABECERA}\nAna Pérez,ana@example.com,1990-01-01,es,en,Z9,,,`;
    const report = analyzeStudentsCsv(csv, AHORA);

    expect(report.invalidCount).toBe(1);
    const error = report.invalidRows[0]!.errors.find((e) => e.code === "invalid_import_field")!;
    expect(error.details).toMatchObject({ field: "nivel" });
  });

  it("nombre, email o idiomas vacíos son errores de fila", () => {
    const csv = `${CABECERA}\n,ana@example.com,1990-01-01,es,en,,,,`;
    const report = analyzeStudentsCsv(csv, AHORA);

    expect(report.invalidCount).toBe(1);
    const error = report.invalidRows[0]!.errors.find((e) => e.code === "invalid_import_field")!;
    expect(error.details).toMatchObject({ field: "nombre" });
  });

  it("un correo con formato inválido es un error de fila", () => {
    const csv = `${CABECERA}\nAna Pérez,no-es-un-correo,1990-01-01,es,en,,,,`;
    const report = analyzeStudentsCsv(csv, AHORA);

    expect(report.invalidCount).toBe(1);
    expect(report.invalidRows[0]!.errors.some((e) => e.details.field === "email")).toBe(true);
  });

  it("un parentesco de tutor que no es ninguno de los cuatro conocidos es un error de fila", () => {
    const csv =
      `${CABECERA}\n` + "Iker Niño,iker@example.com,2015-01-01,es,en,,María Niño,maria@example.com,abuela";
    const report = analyzeStudentsCsv(csv, AHORA);

    expect(report.invalidCount).toBe(1);
    expect(report.invalidRows[0]!.errors.some((e) => e.details.field === "tutor_parentesco")).toBe(true);
  });

  it("una fila con más columnas de las que trae la cabecera (coma sin escapar) es un error de fila", () => {
    const csv = `${CABECERA}\nAna, Pérez,ana@example.com,1990-01-01,es,en,,,,`;
    const report = analyzeStudentsCsv(csv, AHORA);

    expect(report.invalidCount).toBe(1);
  });

  it("faltan columnas obligatorias en la cabecera: aborta la importación entera", () => {
    const csv = "nombre,email\nAna,ana@example.com";
    expect(() => analyzeStudentsCsv(csv, AHORA)).toThrow(/columnas obligatorias/i);
  });

  it("un fichero de 200 filas con 5 errores intencionados deja 195 válidas y 5 señaladas", () => {
    const filas: string[] = [];

    for (let i = 0; i < 200; i++) {
      if (i === 10) {
        filas.push(`Alumno ${i},alumno${i}@example.com,fecha-invalida,es,en,B1,,,`); // fecha mal formada
      } else if (i === 40) {
        filas.push(`Alumno ${i},alumno${i}@example.com,1990-01-01,es,en,Z9,,,`); // nivel inventado
      } else if (i === 90) {
        filas.push(`Alumno ${i},alumno${i}@example.com,2015-01-01,es,en,,,,`); // menor sin tutor
      } else if (i === 120) {
        filas.push(`,alumno${i}@example.com,1990-01-01,es,en,,,,`); // nombre vacío
      } else if (i === 150) {
        filas.push(`Alumno ${i},duplicado@example.com,1990-01-01,es,en,,,,`); // correo duplicado con la 151
      } else if (i === 151) {
        filas.push(`Alumno ${i},duplicado@example.com,1991-01-01,es,en,,,,`);
      } else {
        filas.push(`Alumno ${i},alumno${i}@example.com,1990-01-01,es,en,B1,,,`);
      }
    }

    const csv = `${CABECERA}\n${filas.join("\n")}`;
    const report = analyzeStudentsCsv(csv, AHORA);

    expect(report.totalRows).toBe(200);
    expect(report.invalidCount).toBe(6); // las dos filas del correo duplicado cuentan las dos
    expect(report.validCount).toBe(194);
  });
});
