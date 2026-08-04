import { useState } from "react";
import type { KeyboardEvent, ReactElement, ReactNode } from "react";

export interface TabItem {
  id: string;
  label: ReactNode;
  content: ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  /** Nombre accesible del conjunto de pestañas (`aria-label` del `tablist`). */
  label: string;
}

/**
 * Pestañas de la ficha del alumno.
 *
 * Componente propio de esta pantalla, no del sistema de diseño
 * (`@langopia/ui`): la Tarea 4 no construyó ninguno y esta es, de momento,
 * la única pantalla que lo necesita — no hay motivo para ampliar el sistema
 * de diseño compartido por una tarea que no lo pidió.
 *
 * Sigue el patrón ARIA de pestañas: `role="tablist"`/`"tab"`/`"tabpanel"`,
 * una sola pestaña con `tabIndex=0` a la vez (roving tabindex) y las flechas
 * izquierda/derecha (más Inicio/Fin) para moverse sin usar el ratón.
 */
export function Tabs({ tabs, label }: TabsProps): ReactElement {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === activeId),
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (tabs.length === 0) return;
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (activeIndex + 1) % tabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (activeIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;

    if (nextIndex === null) return;
    event.preventDefault();
    const next = tabs[nextIndex];
    if (!next) return;
    setActiveId(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label={label} onKeyDown={handleKeyDown} className="flex gap-2 border-b border-border">
        {tabs.map((tab) => {
          const selected = tab.id === activeId;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`tabpanel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(tab.id)}
              className="px-3 py-2 text-sm font-medium"
              style={{
                color: selected ? "var(--ink-accent-default)" : "var(--ink-text-secondary)",
                borderBottom: selected ? "2px solid var(--ink-accent-default)" : "2px solid transparent",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`tabpanel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab.id}`}
          hidden={tab.id !== activeId}
          tabIndex={0}
          className="pt-4"
        >
          {tab.id === activeId && tab.content}
        </div>
      ))}
    </div>
  );
}
