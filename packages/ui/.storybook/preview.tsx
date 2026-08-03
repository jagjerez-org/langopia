import type { Preview } from "@storybook/react";
import { useEffect } from "react";
import "../src/theme.css";

/**
 * Decorator global que sincroniza el tema seleccionado en la toolbar de
 * Storybook con el atributo `data-theme` del documento. `theme.css` reacciona
 * a ese atributo para activar el modo oscuro.
 */
function ThemeDecorator(Story, context) {
  const theme = context.globals.theme;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return <Story />;
}

const preview: Preview = {
  globalTypes: {
    theme: {
      name: "Tema",
      description: "Tema claro u oscuro",
      defaultValue: "light",
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
