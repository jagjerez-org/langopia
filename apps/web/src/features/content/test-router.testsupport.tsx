import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import type { ReactElement } from "react";

export type TestRoute = { path: string; component: () => ReactElement };

/**
 * Router mínimo para probar las pantallas de contenido, que usan `<Link>`
 * (`/contenido/:id`, «volver al listado») y `useParams()`. Mismo criterio que
 * el de facturación (Tarea 10): cada prueba monta solo las rutas que
 * necesita, con historial EN MEMORIA, en vez de importar `router.tsx` —esa
 * arrastraría todas las pantallas del panel, acoplando estas pruebas a
 * trabajo de otras tareas.
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
