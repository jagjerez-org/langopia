import type { Preview } from "@storybook/react";
import { useEffect } from "react";
import { useGlobals } from "@storybook/preview-api";
import { applyTheme, getInitialTheme, type Theme } from "../src/lib/theme.js";
import "../src/theme.css";

/**
 * Decorator global que sincroniza el tema seleccionado en la toolbar de
 * Storybook con el atributo `data-theme` del documento del iframe. `theme.css`
 * reacciona a ese atributo para activar el modo oscuro.
 *
 * Al montar, intenta recuperar la preferencia previa desde `localStorage` o
 * `prefers-color-scheme` y la publica como global de Storybook, de forma que
 * la toolbar refleje el valor real.
 */
function ThemeDecorator(Story, context) {
  const [globals, updateGlobals] = useGlobals();
  const theme = globals.theme as Theme | undefined;

  useEffect(() => {
    const initial = getInitialTheme();
    if (theme !== initial) {
      updateGlobals({ theme: initial });
    }
    // Solo se ejecuta una vez al montar el decorador; no repetimos para no
    // pisar cambios manuales del usuario en la toolbar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (theme) {
      applyTheme(theme);
    }
  }, [theme]);

  return <Story />;
}

const preview: Preview = {
  globalTypes: {
    theme: {
      name: "Tema",
      description: "Tema claro u oscuro",
      defaultValue: "light" satisfies Theme,
      toolbar: {
        icon: "circlehollow",
        items: [
          { value: "light", icon: "sun", title: "Claro" },
          { value: "dark", icon: "moon", title: "Oscuro" },
        ],
      },
    },
  },
  decorators: [ThemeDecorator],
  parameters: {
    layout: "padded",
  },
};

export default preview;
