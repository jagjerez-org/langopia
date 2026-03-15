"use client";

import { useEffect, useState } from "react";
import { Lightbulb, ArrowRight, X } from "lucide-react";
import { useTutorial } from "@/components/tutorial-provider";

interface TutorialStep {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

interface TutorialOverlayProps {
  sectionId: string;
  steps: TutorialStep[];
}

export function TutorialOverlay({ sectionId, steps }: TutorialOverlayProps) {
  const { hasSeen, markSeen } = useTutorial();
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [opacity, setOpacity] = useState(0);

  const alreadySeen = hasSeen(sectionId);

  useEffect(() => {
    if (alreadySeen) return;
    // Small delay before showing for smoother UX
    const timer = setTimeout(() => {
      setVisible(true);
      requestAnimationFrame(() => {
        setOpacity(1);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [alreadySeen]);

  if (alreadySeen || !visible || steps.length === 0) {
    return null;
  }

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  function dismiss() {
    setOpacity(0);
    setTimeout(() => {
      setVisible(false);
      markSeen(sectionId);
    }, 200);
  }

  function handleNext() {
    if (isLastStep) {
      dismiss();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
      style={{
        opacity,
        transition: "opacity 200ms ease-in-out",
      }}
    >
      <div className="relative mx-4 max-w-md rounded-2xl border border-zinc-200/40 bg-white/95 p-8 shadow-2xl backdrop-blur-xl dark:border-zinc-700/40 dark:bg-zinc-900/95">
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
          aria-label="Close tutorial"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon */}
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-sm">
          {step.icon ?? <Lightbulb className="h-5 w-5" />}
        </div>

        {/* Content */}
        <h3 className="text-lg font-bold">{step.title}</h3>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {step.description}
        </p>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between">
          {/* Skip */}
          <button
            onClick={dismiss}
            className="text-sm text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            Skip
          </button>

          <div className="flex items-center gap-4">
            {/* Step dots */}
            {steps.length > 1 && (
              <div className="flex items-center gap-1.5">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full transition-colors ${
                      i === currentStep
                        ? "bg-violet-500"
                        : "bg-zinc-300 dark:bg-zinc-600"
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Next / Got it button */}
            <button
              onClick={handleNext}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-shadow hover:shadow-md"
            >
              {isLastStep ? "Got it!" : "Next"}
              {!isLastStep && <ArrowRight className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
