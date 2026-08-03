/**
 * Configuración global de Vitest para @langopia/ui.
 *
 * Con `globals: false` no hay hooks ni matchers implícitos; limpiamos el DOM
 * explícitamente después de cada prueba para que los tests sean independientes.
 */
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
