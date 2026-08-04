import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import type { ReactElement } from "react";

export type TestRoute = { path: string; component: () => ReactElement };

/**
 * Router mínimo para probar pantallas que usan `<Link>` o `useParams()`
 * (Tarea 10: `InvoicesListScreen` enlaza a `/facturacion/:id`,
 * `InvoiceDetailScreen` lee `invoiceId` de la URL). Ninguna de las dos
 * funciona sin un `RouterProvider` de verdad por encima —no hay forma de
 * mockear el contexto del router sin montar uno—, así que cada prueba monta
 * solo las rutas que necesita, con historial EN MEMORIA en `initialPath`, en
 * vez de la aplicación entera (`router.tsx`): esa importaría las pantallas de
 * otras tareas en marcha a la vez, acoplando estas pruebas a un trabajo que
 * no es el suyo.
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
