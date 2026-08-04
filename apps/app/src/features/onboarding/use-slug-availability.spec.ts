import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { checkSlugAvailabilityMock } = vi.hoisted(() => ({ checkSlugAvailabilityMock: vi.fn() }));

vi.mock("./api.js", () => ({ checkSlugAvailability: checkSlugAvailabilityMock }));

const { useSlugAvailability } = await import("./use-slug-availability.js");

describe("useSlugAvailability", () => {
  beforeEach(() => {
    checkSlugAvailabilityMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sin forma plausible, se queda en 'idle' sin llamar a la API", async () => {
    const { result } = renderHook(({ slug }) => useSlugAvailability(slug), { initialProps: { slug: "ab" } });

    expect(result.current).toBe("idle");
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(checkSlugAvailabilityMock).not.toHaveBeenCalled();
  });

  it("con forma plausible, espera el debounce y después pregunta a la API", async () => {
    checkSlugAvailabilityMock.mockResolvedValue({ available: true });
    const { result } = renderHook(({ slug }) => useSlugAvailability(slug), {
      initialProps: { slug: "academia-nueva" },
    });

    expect(result.current).toBe("checking");
    await waitFor(() => expect(result.current).toBe("available"));
    expect(checkSlugAvailabilityMock).toHaveBeenCalledWith("academia-nueva");
  });

  it("cuando la API dice que no está disponible, reporta 'unavailable'", async () => {
    checkSlugAvailabilityMock.mockResolvedValue({ available: false });
    const { result } = renderHook(({ slug }) => useSlugAvailability(slug), { initialProps: { slug: "nordwind" } });

    await waitFor(() => expect(result.current).toBe("unavailable"));
  });

  it("cambiar el slug antes de que termine el debounce cancela la comprobación anterior", async () => {
    checkSlugAvailabilityMock.mockImplementation(async (slug: string) => ({ available: slug === "segunda-opcion" }));
    const { result, rerender } = renderHook(({ slug }) => useSlugAvailability(slug), {
      initialProps: { slug: "primera-opcion" },
    });

    rerender({ slug: "segunda-opcion" });

    await waitFor(() => expect(result.current).toBe("available"));
    expect(checkSlugAvailabilityMock).toHaveBeenCalledTimes(1);
    expect(checkSlugAvailabilityMock).toHaveBeenCalledWith("segunda-opcion");
  });

  it("un fallo de red no finge una respuesta: vuelve a 'idle'", async () => {
    checkSlugAvailabilityMock.mockRejectedValue(new Error("network_error"));
    const { result } = renderHook(({ slug }) => useSlugAvailability(slug), { initialProps: { slug: "academia-nueva" } });

    await waitFor(() => expect(result.current).toBe("idle"));
  });
});
