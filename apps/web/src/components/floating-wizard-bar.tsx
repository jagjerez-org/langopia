"use client";

import { Loader2, Maximize2, X, Upload, ListChecks, CheckCircle, Sparkles } from "lucide-react";
import { useWizard } from "./exercise-wizard-context";

const stepLabels = ["Material & Topic", "Plan Exercises", "Review & Save"];

export function FloatingWizardBar() {
  const { isMinimized, wizardState, analyzing, generating, restoreWizard, closeWizard } = useWizard();

  if (!isMinimized) return null;

  const { step, uploadedFile, planCounts } = wizardState;
  const totalPlan = Object.values(planCounts).reduce((s, c) => s + c, 0);

  // Status text + icon
  let statusText: string;
  let StatusIcon: React.ComponentType<{ className?: string }>;
  let showSpinner = false;

  if (analyzing) {
    statusText = uploadedFile
      ? `Analyzing ${uploadedFile.name.length > 25 ? uploadedFile.name.slice(0, 22) + "..." : uploadedFile.name}`
      : "Analyzing...";
    StatusIcon = Upload;
    showSpinner = true;
  } else if (generating) {
    statusText = `Generating ${totalPlan} exercise${totalPlan !== 1 ? "s" : ""}...`;
    StatusIcon = Sparkles;
    showSpinner = true;
  } else {
    statusText = `Exercise Wizard — ${stepLabels[step] ?? ""}`;
    StatusIcon = step === 0 ? Upload : step === 1 ? ListChecks : CheckCircle;
  }

  // Progress: indeterminate during analyzing/generating, step-based otherwise
  const isIndeterminate = analyzing || generating;
  const progressPercent = ((step + 1) / 3) * 100;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 min-w-[320px] max-w-[400px] animate-in slide-in-from-bottom-4 fade-in duration-300 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
    >
      {/* Main row */}
      <div className="flex items-center gap-3">
        {showSpinner ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-500" />
        ) : (
          <StatusIcon className="h-4 w-4 shrink-0 text-violet-500" />
        )}

        <button
          onClick={restoreWizard}
          className="flex-1 truncate text-left text-sm font-medium text-zinc-700 hover:text-violet-600 dark:text-zinc-300 dark:hover:text-violet-400"
        >
          {statusText}
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={restoreWizard}
            className="rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
            title="Expand"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={closeWizard}
            className="rounded-md p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          {isIndeterminate ? (
            <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-violet-500 to-violet-600" style={{ animation: "shimmer 1.5s ease-in-out infinite" }} />
          ) : (
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-600 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          )}
        </div>
        <span className="text-[10px] font-medium text-zinc-400">
          {analyzing || generating ? "" : `Step ${step + 1}/3`}
        </span>
      </div>

      {/* Shimmer animation */}
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}
