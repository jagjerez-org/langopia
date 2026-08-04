import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, getSchoolSlug, setSchoolSlug } from "../../lib/api-client.js";

const { getSessionMock, getActiveImpersonationMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  getActiveImpersonationMock: vi.fn(),
}));

vi.mock("./api.js", () => ({
  getSession: getSessionMock,
}));
vi.mock("../impersonation/api.js", () => ({
  getActiveImpersonation: getActiveImpersonationMock,
}));

// Importado DESPUÉS de `vi.mock`: así el módulo bajo prueba recibe los dobles.
const { useSession } = await import("./session.js");

const verifiedUser = {
  id: "user-1",
  email: "carla.ruiz@atlantico.example",
  name: "Carla Ruiz",
  emailVerified: true,
};

function tenantResolutionFailed(params?: Record<string, unknown>): ApiError {
  return new ApiError({
    code: "tenant_resolution_failed",
    title: "No se ha podido determinar la escuela para esta petición.",
    status: 403,
    params,
  });
}

function renderSession() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useSession(), { wrapper });
}

describe("useSession (Tarea 3, Paso 1)", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    getActiveImpersonationMock.mockReset();
    setSchoolSlug(undefined);
  });

  afterEach(() => {
    setSchoolSlug(undefined);
  });

  it("sin sesión, reporta 'anonymous' (equivalente a redirigir a /entrar)", async () => {
    getSessionMock.mockResolvedValue(null);

    const { result } = renderSession();

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("anonymous"));
    expect(getActiveImpersonationMock).not.toHaveBeenCalled();
  });

  it("con sesión sin verificar, reporta 'unverified' sin intentar resolver escuela", async () => {
    getSessionMock.mockResolvedValue({
      session: { id: "s1", expiresAt: "2026-08-01T00:00:00.000Z" },
      user: { ...verifiedUser, emailVerified: false },
    });

    const { result } = renderSession();

    await waitFor(() => expect(result.current.status).toBe("unverified"));
    expect(getActiveImpersonationMock).not.toHaveBeenCalled();
  });

  it("con sesión y una sola escuela, entra directo ('ready')", async () => {
    getSessionMock.mockResolvedValue({
      session: { id: "s1", expiresAt: "2026-08-01T00:00:00.000Z" },
      user: verifiedUser,
    });
    getActiveImpersonationMock.mockResolvedValue(null);

    const { result } = renderSession();

    await waitFor(() => expect(result.current.status).toBe("ready"));
    if (result.current.status === "ready") expect(result.current.user.email).toBe(verifiedUser.email);
  });

  it("con sesión y varias escuelas, muestra el selector con los slugs que ofrece la API", async () => {
    getSessionMock.mockResolvedValue({
      session: { id: "s1", expiresAt: "2026-08-01T00:00:00.000Z" },
      user: { ...verifiedUser, email: "dan.whitfield@langopia-teachers.example" },
    });
    getActiveImpersonationMock.mockRejectedValue(
      tenantResolutionFailed({ schools: ["atlantico", "paulista"] }),
    );

    const { result } = renderSession();

    await waitFor(() => expect(result.current.status).toBe("needs-school"));
    if (result.current.status === "needs-school") {
      expect(result.current.schools).toEqual(["atlantico", "paulista"]);
    }
  });

  it("un missing_tenant de la API (p. ej. sesión caducada al resolver) vuelve al selector", async () => {
    getSessionMock.mockResolvedValue({
      session: { id: "s1", expiresAt: "2026-08-01T00:00:00.000Z" },
      user: verifiedUser,
    });
    getActiveImpersonationMock.mockRejectedValue(
      new ApiError({ code: "missing_tenant", title: "Necesitas iniciar sesión.", status: 403 }),
    );

    const { result } = renderSession();

    await waitFor(() => expect(result.current.status).toBe("needs-school"));
    if (result.current.status === "needs-school") expect(result.current.schools).toEqual([]);
  });

  it("una preferencia de escuela guardada que ya no vale se olvida y se reintenta sin ella", async () => {
    setSchoolSlug("escuela-abandonada");
    getSessionMock.mockResolvedValue({
      session: { id: "s1", expiresAt: "2026-08-01T00:00:00.000Z" },
      user: verifiedUser,
    });
    getActiveImpersonationMock
      .mockRejectedValueOnce(tenantResolutionFailed({ requestedSlug: "escuela-abandonada" }))
      .mockResolvedValueOnce(null);

    const { result } = renderSession();

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(getSchoolSlug()).toBeUndefined();
    expect(getActiveImpersonationMock).toHaveBeenCalledTimes(2);
  });
});
