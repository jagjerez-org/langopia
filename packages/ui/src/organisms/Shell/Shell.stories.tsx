import type { Meta, StoryObj } from "@storybook/react";
import type { ComponentType } from "react";
import type { Theme } from "../../lib/theme.js";
import type { ThemeToggleLabels } from "../../atoms/ThemeToggle/ThemeToggle.js";
import type { BottomPageItem } from "../../molecules/BottomPage/BottomPage.js";
import type { BreadcrumbItem } from "../../molecules/Breadcrumb/Breadcrumb.js";
import {
  shellBottomNavItems,
  shellBreadcrumbItems,
  shellNavItems,
  shellThemeLabels,
  shellUser,
  shellUserMenuItems,
} from "../../fixtures/shell.js";
import { Shell } from "./Shell.js";
import type { ShellBaseProps, ShellUserMenuItem } from "./Shell.js";

// Args "planos" solo para las stories: las uniones discriminadas de ShellProps
// colapsan a `never` al pasar por la inferencia de StoryObj/Meta (mismo caso
// que UserComponent). El cast del componente es seguro: cada combinación
// válida de args encaja en la unión.
type StoryArgs = ShellBaseProps & {
  breadcrumb?: BreadcrumbItem[];
  breadcrumbAriaLabel?: string;
  bottomNavItems?: BottomPageItem[];
  bottomNavAriaLabel?: string;
  theme?: Theme;
  onThemeChange?: (theme: Theme) => void;
  themeLabels?: ThemeToggleLabels;
  userMenuItems?: ShellUserMenuItem[];
  userMenuLabel?: string;
  onToggleCollapse?: () => void;
  toggleCollapseLabel?: string;
};

const demoContent = (
  <div className="flex flex-col gap-4">
    <p className="m-0 text-muted">
      Área de contenido de la página. El Shell aporta la navegación, la barra
      superior y, en móvil, la barra inferior; esto es lo que ponga la app.
    </p>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {["Informe anual 2025", "Propuesta de presupuesto", "Acta de la reunión"].map((title) => (
        <div key={title} className="rounded-lg border border-border bg-surface p-4">
          <h2 className="m-0 text-[length:var(--ink-text-base)] font-semibold text-text">
            {title}
          </h2>
          <p className="m-0 mt-1 text-[length:var(--ink-text-sm)] text-muted">
            Actualizado hace 2 días
          </p>
        </div>
      ))}
    </div>
  </div>
);

const meta = {
  title: "Organisms/Shell",
  component: Shell as ComponentType<StoryArgs>,
  tags: ["autodocs"],
  parameters: {
    // El Shell ocupa toda la ventana: sin el marco con relleno de docs.
    layout: "fullscreen",
  },
  args: {
    navItems: shellNavItems,
    navAriaLabel: "Navegación principal",
    title: "Alumnos",
    user: shellUser,
    theme: "light",
    onThemeChange: () => {},
    themeLabels: shellThemeLabels,
    userMenuItems: shellUserMenuItems,
    userMenuLabel: "Menú de usuario",
    children: demoContent,
  },
} satisfies Meta<StoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Collapsed: Story = {
  args: {
    collapsed: true,
    onToggleCollapse: () => {},
    toggleCollapseLabel: "Alternar navegación",
  },
};

export const Mobile: Story = {
  args: {
    bottomNavItems: shellBottomNavItems,
    bottomNavAriaLabel: "Navegación inferior",
  },
  parameters: {
    // Viewport de móvil: la navegación lateral se oculta y manda la barra inferior.
    viewport: { defaultViewport: "mobile1" },
  },
};

export const WithBreadcrumb: Story = {
  args: {
    title: "Ana García",
    breadcrumb: shellBreadcrumbItems,
    breadcrumbAriaLabel: "Migas de pan",
  },
};
