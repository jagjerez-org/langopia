"use client";

import { useEffect, useState } from "react";
import { useAcademy } from "@/components/academy-provider";
import { useApiClient } from "@/hooks/use-api-client";

export interface AcademyLevel {
  code: string;
  label: string;
}

/**
 * Fetches the academy's custom levels.
 * Returns { levels, levelCodes } where levelCodes is a simple string[]
 * suitable for dropdowns that previously used CEFR_LEVELS.
 */
export function useAcademyLevels() {
  const { selectedAcademy } = useAcademy();
  const api = useApiClient();
  const [levels, setLevels] = useState<AcademyLevel[]>([]);

  useEffect(() => {
    if (!selectedAcademy) {
      setLevels([]);
      return;
    }
    api.academyLevels
      .list(selectedAcademy)
      .then((data) => {
        setLevels(
          [...data]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((l) => ({ code: l.code, label: l.label }))
        );
      })
      .catch(() => setLevels([]));
  }, [selectedAcademy, api]);

  const levelCodes = levels.map((l) => l.code);

  return { levels, levelCodes };
}
