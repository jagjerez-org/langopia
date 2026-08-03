import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { applyTheme, getInitialTheme, toggleTheme } from "./theme.js";

const STORAGE_KEY = "langopia:theme" as const;

describe("theme utilities", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    window.localStorage.clear();
  });

  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
    window.localStorage.clear();
  });

  describe("getInitialTheme", () => {
    it("devuelve el valor de localStorage si es válido", () => {
      window.localStorage.setItem(STORAGE_KEY, "dark");

      expect(getInitialTheme()).toBe("dark");
    });

    it("ignora valores no válidos de localStorage y consulta prefers-color-scheme", () => {
      window.localStorage.setItem(STORAGE_KEY, "auto");

      const result = getInitialTheme();

      expect(result === "light" || result === "dark").toBe(true);
    });

    it("devuelve 'light' por defecto cuando no hay preferencia", () => {
      expect(getInitialTheme()).toBe("light");
    });
  });

  describe("applyTheme", () => {
    it("escribe data-theme en el elemento raíz", () => {
      applyTheme("dark");

      expect(document.documentElement.dataset.theme).toBe("dark");
    });
  });

  describe("toggleTheme", () => {
    it("invierte de claro a oscuro y persiste", () => {
      applyTheme("light");

      const result = toggleTheme();

      expect(result).toBe("dark");
      expect(document.documentElement.dataset.theme).toBe("dark");
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe("dark");
    });

    it("invierte de oscuro a claro y persiste", () => {
      applyTheme("dark");

      const result = toggleTheme();

      expect(result).toBe("light");
      expect(document.documentElement.dataset.theme).toBe("light");
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe("light");
    });

    it("por defecto invierte a oscuro si no hay tema establecido", () => {
      const result = toggleTheme();

      expect(result).toBe("dark");
    });
  });
});
