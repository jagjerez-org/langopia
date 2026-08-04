import type { MouseEvent, ReactElement, ReactNode } from "react";
import { ItemList } from "../../atoms/ItemList/ItemList.js";
import { ThemeToggle, type ThemeToggleLabels } from "../../atoms/ThemeToggle/ThemeToggle.js";
import { TreeDots } from "../../atoms/TreeDots/TreeDots.js";
import type { Theme } from "../../lib/theme.js";
import { BottomPage, type BottomPageItem } from "../../molecules/BottomPage/BottomPage.js";
import { Breadcrumb, type BreadcrumbItem } from "../../molecules/Breadcrumb/Breadcrumb.js";
import { SideNavBar, type SideNavBarItem } from "../../molecules/SideNavBar/SideNavBar.js";
import { TopNavBar } from "../../molecules/TopNavBar/TopNavBar.js";
import { UserComponent, type UserComponentProps } from "../../molecules/UserComponent/UserComponent.js";

/** Entrada del menú de usuario que se abre desde el `TreeDots` de la barra superior. */
export interface ShellUserMenuItem {
  /** Etiqueta de la acción, ya traducida. */
  label: string;
  /** Con `href` la entrada es un enlace. */
  href?: string;
  /** Acción al pulsar (compatible con `href`: se notifica además de navegar). */
  onClick?: () => void;
}

export interface ShellBaseProps {
  /** Destinos de la navegación lateral, en orden. */
  navItems: SideNavBarItem[];
  /** Nombre accesible del landmark de navegación lateral (p. ej. "Navegación principal"). */
  navAriaLabel: string;
  /** Navegación lateral colapsada a iconos (las etiquetas siguen accesibles). */
  collapsed?: boolean;
  /** Título de la página, ya traducido. */
  title?: ReactNode;
  /** Slot de acciones extra de la barra superior; se muestran antes del tema y el usuario. */
  topBarActions?: ReactNode;
  /** Usuario de la sesión, tal y como lo pinta la molécula `UserComponent`. */
  user: UserComponentProps;
  /**
   * Callback adicional a los `href`: recibe el destino de cualquier enlace de
   * la navegación lateral al pulsarlo (útil para analítica o routers).
   */
  onNavigate?: (href: string) => void;
  /** Contenido de la página; se renderiza dentro del landmark `<main>`. */
  children: ReactNode;
}

/** Migas de pan: todo o nada, con su nombre accesible. */
export type ShellBreadcrumbProps =
  | {
      /** Niveles de la jerarquía; el último es la página actual. */
      breadcrumb: BreadcrumbItem[];
      /** Nombre accesible del landmark de las migas (p. ej. "Migas de pan"). */
      breadcrumbAriaLabel: string;
    }
  | { breadcrumb?: undefined; breadcrumbAriaLabel?: undefined };

/** Barra inferior móvil: todo o nada, con su nombre accesible. */
export type ShellBottomNavProps =
  | {
      /** Acciones de la barra inferior (solo visible bajo `md`). */
      bottomNavItems: BottomPageItem[];
      /** Nombre accesible del landmark de la barra inferior. */
      bottomNavAriaLabel: string;
    }
  | { bottomNavItems?: undefined; bottomNavAriaLabel?: undefined };

/** Interruptor de tema: controlado, todo o nada. */
export type ShellThemeProps =
  | {
      /** Tema actual. */
      theme: Theme;
      /** Notifica el tema elegido en el interruptor. */
      onThemeChange: (theme: Theme) => void;
      /** Textos del interruptor, ya traducidos. */
      themeLabels: ThemeToggleLabels;
    }
  | { theme?: undefined; onThemeChange?: undefined; themeLabels?: undefined };

/** Menú de usuario del `TreeDots`: todo o nada, con el nombre del disparador. */
export type ShellUserMenuProps =
  | {
      /** Entradas del menú de usuario, en orden. */
      userMenuItems: ShellUserMenuItem[];
      /** Nombre accesible del disparador del menú (p. ej. "Menú de usuario"). */
      userMenuLabel: string;
    }
  | { userMenuItems?: undefined; userMenuLabel?: undefined };

/** Botón para colapsar/expandir la navegación lateral: todo o nada. */
export type ShellCollapseProps =
  | {
      /** Alterna el modo colapsado; el estado lo controla quien llama (`collapsed`). */
      onToggleCollapse: () => void;
      /** Nombre accesible del botón de alternar. */
      toggleCollapseLabel: string;
    }
  | { onToggleCollapse?: undefined; toggleCollapseLabel?: undefined };

export type ShellProps = ShellBaseProps &
  ShellBreadcrumbProps &
  ShellBottomNavProps &
  ShellThemeProps &
  ShellUserMenuProps &
  ShellCollapseProps;

const shellStyles = "flex h-dvh w-full bg-surface font-sans text-text";

const sideNavWrapperStyles =
  // Bajo `md` la navegación lateral se oculta: ahí manda la barra inferior.
  "hidden h-full shrink-0 md:block";

const bodyStyles = "flex min-w-0 flex-1 flex-col";

const mainBaseStyles = "min-h-0 flex-1 overflow-y-auto p-4";

const bottomNavWrapperStyles = "md:hidden";

/**
 * Layout de la app autenticada: `SideNavBar` a la izquierda, `TopNavBar`
 * arriba (título, migas y acciones: extras + `ThemeToggle` + `UserComponent` +
 * menú de usuario en `TreeDots`), contenido en `<main>` y `BottomPage`
 * opcional para móvil.
 *
 * Responsive solo con CSS (breakpoints de Tailwind, sin JS de media queries):
 * - Bajo `md`: la navegación lateral se oculta y la navegación principal pasa
 *   a la barra inferior (`bottomNavItems`).
 * - Desde `md`: visible la navegación lateral; el modo colapsado a iconos es
 *   un estado controlado por props (`collapsed` + `onToggleCollapse`), no por
 *   breakpoint — colapsar solo en `md` exigiría duplicar el landmark en el DOM
 *   o leer el viewport con JS, ambos descartados.
 *
 * Es presentacional: no conoce la sesión, el tema ni el router; todo llega
 * por props, textos incluidos.
 */
export function Shell({
  navItems,
  navAriaLabel,
  collapsed = false,
  title,
  breadcrumb,
  breadcrumbAriaLabel,
  topBarActions,
  user,
  theme,
  onThemeChange,
  themeLabels,
  userMenuItems,
  userMenuLabel,
  bottomNavItems,
  bottomNavAriaLabel,
  onToggleCollapse,
  toggleCollapseLabel,
  onNavigate,
  children,
}: ShellProps): ReactElement {
  // Delegación de clics sobre la navegación lateral: los enlaces siguen
  // navegando por `href`; el callback solo se entera del destino.
  const handleSideNavClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!onNavigate) return;
    const anchor = (event.target as HTMLElement).closest("a[href]");
    const href = anchor?.getAttribute("href");
    if (href) onNavigate(href);
  };

  const actions = (
    <>
      {topBarActions}
      {theme !== undefined && onThemeChange !== undefined && themeLabels !== undefined && (
        <ThemeToggle value={theme} onChange={onThemeChange} labels={themeLabels} />
      )}
      <UserComponent {...user} />
      {userMenuItems !== undefined && userMenuLabel !== undefined && (
        <TreeDots triggerLabel={userMenuLabel}>
          {userMenuItems.map((item) => (
            <ItemList key={item.label} href={item.href} onClick={item.onClick}>
              {item.label}
            </ItemList>
          ))}
        </TreeDots>
      )}
    </>
  );

  const mainStyles =
    // Con barra inferior, aire extra abajo en móvil para no tapar el contenido.
    bottomNavItems !== undefined ? `${mainBaseStyles} pb-24 md:pb-4` : mainBaseStyles;

  return (
    <div className={shellStyles}>
      <div className={sideNavWrapperStyles} onClick={handleSideNavClick}>
        {/* La unión todo-o-nada de SideNavBar no admite props sueltas: o el par
            onToggleCollapse + toggleLabel, o ninguno. */}
        {onToggleCollapse !== undefined && toggleCollapseLabel !== undefined ? (
          <SideNavBar
            items={navItems}
            ariaLabel={navAriaLabel}
            collapsed={collapsed}
            onToggleCollapse={onToggleCollapse}
            toggleLabel={toggleCollapseLabel}
          />
        ) : (
          <SideNavBar items={navItems} ariaLabel={navAriaLabel} collapsed={collapsed} />
        )}
      </div>
      <div className={bodyStyles}>
        <TopNavBar
          title={title}
          breadcrumb={
            breadcrumb !== undefined && breadcrumbAriaLabel !== undefined ? (
              <Breadcrumb items={breadcrumb} ariaLabel={breadcrumbAriaLabel} />
            ) : undefined
          }
          actions={actions}
          sticky
        />
        <main className={mainStyles}>{children}</main>
      </div>
      {bottomNavItems !== undefined && bottomNavAriaLabel !== undefined && (
        <div className={bottomNavWrapperStyles}>
          <BottomPage items={bottomNavItems} ariaLabel={bottomNavAriaLabel} />
        </div>
      )}
    </div>
  );
}
