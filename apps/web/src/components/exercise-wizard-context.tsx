"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";
import type { AnalyzeExerciseResponse } from "@langopia/api-client";

// ─── Types ──────────────────────────────────────────────

export interface WizardConfig {
  lessonId?: string;
  lessonTitle?: string;
  language?: string;
  cefrLevel?: string;
  levelCodes?: string[];
  onComplete?: () => void;
}

export interface WizardState {
  step: number;
  topic: string;
  language: string;
  cefrLevel: string;
  uploadedFile: File | null;
  analysis: AnalyzeExerciseResponse | null;
  planCounts: Record<string, number>;
  lessonId?: string;
  lessonTitle?: string;
  levelCodes: string[];
}

interface WizardContextValue {
  isOpen: boolean;
  isMinimized: boolean;
  wizardState: WizardState;
  analyzing: boolean;
  generating: boolean;
  onCompleteRef: React.RefObject<(() => void) | undefined>;
  openWizard: (config?: WizardConfig) => void;
  minimizeWizard: () => void;
  restoreWizard: () => void;
  closeWizard: () => void;
  updateState: (partial: Partial<WizardState>) => void;
  setAnalyzing: (v: boolean) => void;
  setGenerating: (v: boolean) => void;
}

const defaultState: WizardState = {
  step: 0,
  topic: "",
  language: "en",
  cefrLevel: "",
  uploadedFile: null,
  analysis: null,
  planCounts: {},
  levelCodes: [],
};

// ─── Context ────────────────────────────────────────────

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [wizardState, setWizardState] = useState<WizardState>(defaultState);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const onCompleteRef = useRef<(() => void) | undefined>(undefined);

  const openWizard = useCallback((config?: WizardConfig) => {
    setWizardState({
      ...defaultState,
      topic: config?.lessonTitle ?? "",
      language: config?.language ?? "en",
      cefrLevel: config?.cefrLevel ?? "",
      lessonId: config?.lessonId,
      lessonTitle: config?.lessonTitle,
      levelCodes: config?.levelCodes ?? [],
    });
    onCompleteRef.current = config?.onComplete;
    setIsMinimized(false);
    setIsOpen(true);
    setAnalyzing(false);
    setGenerating(false);
  }, []);

  const minimizeWizard = useCallback(() => {
    setIsMinimized(true);
    setIsOpen(false);
  }, []);

  const restoreWizard = useCallback(() => {
    setIsMinimized(false);
    setIsOpen(true);
  }, []);

  const closeWizard = useCallback(() => {
    setIsOpen(false);
    setIsMinimized(false);
    setWizardState(defaultState);
    setAnalyzing(false);
    setGenerating(false);
    onCompleteRef.current = undefined;
  }, []);

  const updateState = useCallback((partial: Partial<WizardState>) => {
    setWizardState((prev) => ({ ...prev, ...partial }));
  }, []);

  return (
    <WizardContext.Provider
      value={{
        isOpen,
        isMinimized,
        wizardState,
        analyzing,
        generating,
        onCompleteRef,
        openWizard,
        minimizeWizard,
        restoreWizard,
        closeWizard,
        updateState,
        setAnalyzing,
        setGenerating,
      }}
    >
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard must be used within WizardProvider");
  return ctx;
}
