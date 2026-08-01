import { describe, expect, it } from "vitest";
import { parseCsv } from "./parse-csv.js";

describe("parseCsv", () => {
  it("separa cabecera y filas por comas", () => {
    const csv = "nombre,email\nAna Pérez,ana@example.com\n";
    const { headers, records } = parseCsv(csv);

    expect(headers).toEqual(["nombre", "email"]);
    expect(records).toHaveLength(1);
    expect(records[0]!.values.get("nombre")).toBe("Ana Pérez");
    expect(records[0]!.values.get("email")).toBe("ana@example.com");
  });

  it("entiende un campo entre comillas con una coma dentro", () => {
    const csv = 'nombre,email\n"Pérez, Ana",ana@example.com\n';
    const { records } = parseCsv(csv);

    expect(records[0]!.values.get("nombre")).toBe("Pérez, Ana");
  });

  it("entiende comillas escapadas dentro de un campo entre comillas", () => {
    const csv = 'nombre,email\n"Ana ""la profe"" Pérez",ana@example.com\n';
    const { records } = parseCsv(csv);

    expect(records[0]!.values.get("nombre")).toBe('Ana "la profe" Pérez');
  });

  it("entiende un salto de línea dentro de un campo entre comillas", () => {
    const csv = 'nombre,email\n"Ana\nPérez",ana@example.com\n';
    const { records } = parseCsv(csv);

    expect(records[0]!.values.get("nombre")).toBe("Ana\nPérez");
  });

  it("acepta CRLF y LF mezclados en el mismo fichero", () => {
    const csv = "nombre,email\r\nAna,ana@example.com\nBerta,berta@example.com\r\n";
    const { records } = parseCsv(csv);

    expect(records).toHaveLength(2);
    expect(records[0]!.values.get("nombre")).toBe("Ana");
    expect(records[1]!.values.get("nombre")).toBe("Berta");
  });

  it("descarta un BOM inicial en vez de tratarlo como parte de la primera cabecera", () => {
    const csv = "﻿nombre,email\nAna,ana@example.com\n";
    const { headers } = parseCsv(csv);

    expect(headers[0]).toBe("nombre");
  });

  it("ignora líneas completamente en blanco", () => {
    const csv = "nombre,email\nAna,ana@example.com\n\nBerta,berta@example.com\n";
    const { records } = parseCsv(csv);

    expect(records).toHaveLength(2);
  });

  it("la cabecera no distingue mayúsculas ni el orden de las columnas", () => {
    const csv = "EMAIL,Nombre\nana@example.com,Ana\n";
    const { headers, records } = parseCsv(csv);

    expect(headers).toEqual(["email", "nombre"]);
    expect(records[0]!.values.get("nombre")).toBe("Ana");
    expect(records[0]!.values.get("email")).toBe("ana@example.com");
  });

  it("marca columnMismatch cuando una fila trae más o menos campos que la cabecera", () => {
    const csv = "nombre,email,fecha_nacimiento\nAna,ana@example.com\n";
    const { records } = parseCsv(csv);

    expect(records[0]!.columnMismatch).toBe(true);
    expect(records[0]!.expectedColumns).toBe(3);
    expect(records[0]!.actualColumns).toBe(2);
  });

  it("rechaza un CSV con una comilla sin cerrar en vez de leer basura hasta el final", () => {
    const csv = 'nombre,email\n"Ana,ana@example.com\n';
    expect(() => parseCsv(csv)).toThrow(/comilla sin cerrar/i);
  });

  it("rechaza un fichero vacío", () => {
    expect(() => parseCsv("")).toThrow(/vacío/i);
  });
});
