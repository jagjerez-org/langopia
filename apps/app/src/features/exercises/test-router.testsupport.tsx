import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import type { ReactElement } from "react";

export type TestRoute = { path: string; component: () => ReactElement };

/**
 * Router mínimo para probar las pantallas de ejercicios, que usan
 * `usePortalStudentId()` (`useSearch`/`useNavigate`) para recordar de qué
 * alumno se está mirando el trabajo. Mismo criterio que el de contenido y el
 * de facturación: cada prueba monta solo las rutas que necesita, con historial
 * EN MEMORIA, en vez de importar `router.tsx` —esa arrastraría todas las
 * pantallas del panel, acoplando estas pruebas a trabajo de otras tareas.
 */
export function createTestRouter(initialPath: string, routes: TestRoute[]) {
  const rootRoute = createRootRoute();
  const children = routes.map((route) =>
    createRoute({ getParentRoute: () => rootRoute, path: route.path, component: route.component }),
  );
  const routeTree = rootRoute.addChildren(children);
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
}
