"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  GraduationCap,
  Globe,
  CreditCard,
  LinkIcon,
  CheckCircle2,
  Plus,
  X,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useAcademy } from "@/components/academy-provider";
import { useApiClient } from "@/hooks/use-api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types & constants                                                  */
/* ------------------------------------------------------------------ */

type OnboardingStepKey =
  | "academy_setup"
  | "levels"
  | "languages"
  | "plans"
  | "stripe_connect"
  | "complete";

interface StepMeta {
  key: OnboardingStepKey;
  label: string;
  icon: React.ReactNode;
}

const STEPS: StepMeta[] = [
  { key: "academy_setup", label: "Academy Setup", icon: <Building2 className="h-5 w-5" /> },
  { key: "levels", label: "Levels", icon: <GraduationCap className="h-5 w-5" /> },
  { key: "languages", label: "Languages", icon: <Globe className="h-5 w-5" /> },
  { key: "plans", label: "Plans", icon: <CreditCard className="h-5 w-5" /> },
  { key: "stripe_connect", label: "Stripe Connect", icon: <LinkIcon className="h-5 w-5" /> },
  { key: "complete", label: "Complete", icon: <CheckCircle2 className="h-5 w-5" /> },
];

const DEFAULT_LEVELS = [
  { code: "A1", name: "Beginner" },
  { code: "A2", name: "Elementary" },
  { code: "B1", name: "Intermediate" },
  { code: "B2", name: "Upper Intermediate" },
  { code: "C1", name: "Advanced" },
  { code: "C2", name: "Proficiency" },
];

const DEFAULT_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
];

interface LevelItem {
  code: string;
  name: string;
}

interface LanguageItem {
  code: string;
  name: string;
}

interface PlanItem {
  name: string;
  price: number;
  periodicity: "monthly" | "quarterly" | "yearly";
  limits: { maxIndividualClasses: number };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function OnboardingPage() {
  const router = useRouter();
  const { selectedAcademy, selectedAcademyData, loading: academyLoading } = useAcademy();
  const api = useApiClient();

  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<OnboardingStepKey>>(new Set());

  // Step 1 state
  const [academyName, setAcademyName] = useState("");
  const [academyType, setAcademyType] = useState<"freelance" | "academy">("freelance");
  const [logoUrl, setLogoUrl] = useState("");

  // Step 2 state
  const [levels, setLevels] = useState<LevelItem[]>([]);
  const [newLevelCode, setNewLevelCode] = useState("");
  const [newLevelName, setNewLevelName] = useState("");

  // Step 3 state
  const [languages, setLanguages] = useState<LanguageItem[]>([]);
  const [newLangCode, setNewLangCode] = useState("");
  const [newLangName, setNewLangName] = useState("");

  // Step 4 state
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanPrice, setNewPlanPrice] = useState("");
  const [newPlanPeriodicity, setNewPlanPeriodicity] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [newPlanClasses, setNewPlanClasses] = useState("");

  /* Load progress on mount */
  const loadProgress = useCallback(async () => {
    if (!selectedAcademy) return;
    try {
      const progress = await api.onboarding.getProgress(selectedAcademy) as {
        completedSteps?: OnboardingStepKey[];
      };
      if (progress?.completedSteps?.length) {
        const set = new Set<OnboardingStepKey>(progress.completedSteps);
        setCompletedSteps(set);
        // Resume at the first incomplete step
        const idx = STEPS.findIndex((s) => !set.has(s.key));
        if (idx >= 0) setCurrentStep(idx);
        else setCurrentStep(STEPS.length - 1);
      }
    } catch {
      /* first time — no progress yet */
    }
  }, [selectedAcademy, api]);

  useEffect(() => {
    if (selectedAcademyData) {
      setAcademyName(selectedAcademyData.name || "");
      setAcademyType((selectedAcademyData.academyType as "freelance" | "academy") || "freelance");
    }
  }, [selectedAcademyData]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  /* ---------------------------------------------------------------- */
  /*  Step save handlers                                               */
  /* ---------------------------------------------------------------- */

  async function markStepComplete(step: OnboardingStepKey) {
    if (!selectedAcademy) return;
    await api.onboarding.completeStep(selectedAcademy, { step });
    setCompletedSteps((prev) => new Set(prev).add(step));
  }

  async function saveAcademySetup() {
    if (!selectedAcademy) return;
    if (!academyName.trim()) {
      toast.error("Academy name is required");
      return false;
    }
    await api.academies.update(selectedAcademy, {
      name: academyName.trim(),
      logoUrl: logoUrl.trim() || undefined,
    });
    await markStepComplete("academy_setup");
    toast.success("Academy info saved");
    return true;
  }

  async function saveLevels() {
    if (!selectedAcademy) return;
    if (levels.length === 0) {
      toast.error("Add at least one level");
      return false;
    }
    for (let i = 0; i < levels.length; i++) {
      await api.academyLevels.create(selectedAcademy, {
        code: levels[i].code,
        name: levels[i].name,
        sortOrder: i,
      });
    }
    await markStepComplete("levels");
    toast.success("Levels saved");
    return true;
  }

  async function saveLanguages() {
    if (!selectedAcademy) return;
    if (languages.length === 0) {
      toast.error("Add at least one language");
      return false;
    }
    for (let i = 0; i < languages.length; i++) {
      await api.academyLanguages.create(selectedAcademy, {
        code: languages[i].code,
        name: languages[i].name,
        sortOrder: i,
      });
    }
    await markStepComplete("languages");
    toast.success("Languages saved");
    return true;
  }

  async function savePlans() {
    if (!selectedAcademy) return;
    if (plans.length === 0) {
      toast.error("Add at least one plan");
      return false;
    }
    for (const plan of plans) {
      await api.academyPlans.create(selectedAcademy, {
        name: plan.name,
        price: plan.price,
        periodicity: plan.periodicity,
        limits: plan.limits,
      });
    }
    await markStepComplete("plans");
    toast.success("Plans saved");
    return true;
  }

  async function initiateStripeConnect() {
    if (!selectedAcademy) return;
    try {
      const result = await api.stripe.connectOnboard({ academyId: selectedAcademy }) as { url?: string };
      if (result?.url) {
        await markStepComplete("stripe_connect");
        window.location.href = result.url;
      } else {
        toast.error("Could not start Stripe Connect onboarding");
      }
    } catch {
      toast.error("Failed to start Stripe Connect");
    }
    return true;
  }

  async function completeOnboarding() {
    if (!selectedAcademy) return;
    await markStepComplete("complete");
    toast.success("Onboarding complete! Welcome to Langopia.");
    router.push("/dashboard");
  }

  /* ---------------------------------------------------------------- */
  /*  Navigation                                                       */
  /* ---------------------------------------------------------------- */

  async function handleNext() {
    setSaving(true);
    try {
      let ok = true;
      switch (STEPS[currentStep].key) {
        case "academy_setup":
          ok = (await saveAcademySetup()) ?? false;
          break;
        case "levels":
          ok = (await saveLevels()) ?? false;
          break;
        case "languages":
          ok = (await saveLanguages()) ?? false;
          break;
        case "plans":
          ok = (await savePlans()) ?? false;
          break;
        case "stripe_connect":
          ok = (await initiateStripeConnect()) ?? false;
          break;
        case "complete":
          await completeOnboarding();
          return;
      }
      if (ok && currentStep < STEPS.length - 1) {
        setCurrentStep((s) => s + 1);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  function handleBack() {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }

  /* ---------------------------------------------------------------- */
  /*  Helpers                                                          */
  /* ---------------------------------------------------------------- */

  function addLevel() {
    if (!newLevelCode.trim() || !newLevelName.trim()) return;
    if (levels.some((l) => l.code === newLevelCode.trim())) {
      toast.error("Level code already exists");
      return;
    }
    setLevels([...levels, { code: newLevelCode.trim(), name: newLevelName.trim() }]);
    setNewLevelCode("");
    setNewLevelName("");
  }

  function removeLevel(code: string) {
    setLevels(levels.filter((l) => l.code !== code));
  }

  function addDefaultLevels() {
    const existing = new Set(levels.map((l) => l.code));
    const toAdd = DEFAULT_LEVELS.filter((l) => !existing.has(l.code));
    setLevels([...levels, ...toAdd]);
  }

  function addLanguage() {
    if (!newLangCode.trim() || !newLangName.trim()) return;
    if (languages.some((l) => l.code === newLangCode.trim())) {
      toast.error("Language code already exists");
      return;
    }
    setLanguages([...languages, { code: newLangCode.trim(), name: newLangName.trim() }]);
    setNewLangCode("");
    setNewLangName("");
  }

  function removeLanguage(code: string) {
    setLanguages(languages.filter((l) => l.code !== code));
  }

  function addDefaultLanguages() {
    const existing = new Set(languages.map((l) => l.code));
    const toAdd = DEFAULT_LANGUAGES.filter((l) => !existing.has(l.code));
    setLanguages([...languages, ...toAdd]);
  }

  function addPlan() {
    if (!newPlanName.trim() || !newPlanPrice || !newPlanClasses) return;
    setPlans([
      ...plans,
      {
        name: newPlanName.trim(),
        price: parseFloat(newPlanPrice),
        periodicity: newPlanPeriodicity,
        limits: { maxIndividualClasses: parseInt(newPlanClasses, 10) },
      },
    ]);
    setNewPlanName("");
    setNewPlanPrice("");
    setNewPlanClasses("");
  }

  function removePlan(idx: number) {
    setPlans(plans.filter((_, i) => i !== idx));
  }

  /* ---------------------------------------------------------------- */
  /*  Loading state                                                    */
  /* ---------------------------------------------------------------- */

  if (academyLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!selectedAcademy) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-zinc-500">No academy selected. Please select an academy first.</p>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Step renderers                                                   */
  /* ---------------------------------------------------------------- */

  function renderAcademySetup() {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Academy Setup</h2>
            <p className="text-sm text-zinc-500">Basic information about your academy</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Academy Name</label>
            <Input
              value={academyName}
              onChange={(e) => setAcademyName(e.target.value)}
              placeholder="My Language Academy"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Logo URL (optional)</label>
            <Input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Academy Type</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setAcademyType("freelance")}
                className={cn(
                  "flex-1 rounded-lg border p-4 text-left transition",
                  academyType === "freelance"
                    ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30"
                    : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600",
                )}
              >
                <p className="font-medium">Freelance</p>
                <p className="text-xs text-zinc-500">Single teacher, you are the only instructor</p>
              </button>
              <button
                type="button"
                onClick={() => setAcademyType("academy")}
                className={cn(
                  "flex-1 rounded-lg border p-4 text-left transition",
                  academyType === "academy"
                    ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30"
                    : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600",
                )}
              >
                <p className="font-medium">Academy</p>
                <p className="text-xs text-zinc-500">Multiple teachers, manage a team</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderLevels() {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Levels</h2>
            <p className="text-sm text-zinc-500">Define proficiency levels for your students</p>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={addDefaultLevels}>
          <Sparkles className="mr-1.5 h-4 w-4" />
          Add CEFR defaults (A1-C2)
        </Button>

        {levels.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {levels.map((level) => (
              <Badge key={level.code} variant="secondary" className="gap-1.5 py-1.5 pl-3 pr-2 text-sm">
                <span className="font-semibold">{level.code}</span>
                <span className="text-zinc-500">{level.name}</span>
                <button
                  type="button"
                  onClick={() => removeLevel(level.code)}
                  className="ml-1 rounded-full p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            value={newLevelCode}
            onChange={(e) => setNewLevelCode(e.target.value)}
            placeholder="Code (e.g. B1)"
            className="w-28"
          />
          <Input
            value={newLevelName}
            onChange={(e) => setNewLevelName(e.target.value)}
            placeholder="Name (e.g. Intermediate)"
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && addLevel()}
          />
          <Button variant="outline" size="icon" onClick={addLevel}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  function renderLanguages() {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 text-white">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Languages</h2>
            <p className="text-sm text-zinc-500">Which languages does your academy teach?</p>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={addDefaultLanguages}>
          <Sparkles className="mr-1.5 h-4 w-4" />
          Add common languages
        </Button>

        {languages.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {languages.map((lang) => (
              <Badge key={lang.code} variant="secondary" className="gap-1.5 py-1.5 pl-3 pr-2 text-sm">
                <span className="font-semibold">{lang.code}</span>
                <span className="text-zinc-500">{lang.name}</span>
                <button
                  type="button"
                  onClick={() => removeLanguage(lang.code)}
                  className="ml-1 rounded-full p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            value={newLangCode}
            onChange={(e) => setNewLangCode(e.target.value)}
            placeholder="Code (e.g. en)"
            className="w-28"
          />
          <Input
            value={newLangName}
            onChange={(e) => setNewLangName(e.target.value)}
            placeholder="Name (e.g. English)"
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && addLanguage()}
          />
          <Button variant="outline" size="icon" onClick={addLanguage}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  function renderPlans() {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Student Plans</h2>
            <p className="text-sm text-zinc-500">Create subscription plans for your students</p>
          </div>
        </div>

        {plans.length > 0 && (
          <div className="space-y-3">
            {plans.map((plan, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
              >
                <div>
                  <p className="font-medium">{plan.name}</p>
                  <p className="text-sm text-zinc-500">
                    ${plan.price}/{plan.periodicity} &middot; {plan.limits.maxIndividualClasses} classes
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removePlan(idx)}
                  className="rounded-full p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <X className="h-4 w-4 text-zinc-400" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3 rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-600">
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Add a new plan</p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              value={newPlanName}
              onChange={(e) => setNewPlanName(e.target.value)}
              placeholder="Plan name"
            />
            <Input
              type="number"
              value={newPlanPrice}
              onChange={(e) => setNewPlanPrice(e.target.value)}
              placeholder="Price ($)"
              min="0"
              step="0.01"
            />
            <select
              value={newPlanPeriodicity}
              onChange={(e) => setNewPlanPeriodicity(e.target.value as "monthly" | "quarterly" | "yearly")}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
            <Input
              type="number"
              value={newPlanClasses}
              onChange={(e) => setNewPlanClasses(e.target.value)}
              placeholder="Classes per period"
              min="1"
            />
          </div>
          <Button variant="outline" size="sm" onClick={addPlan}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Plan
          </Button>
        </div>
      </div>
    );
  }

  function renderStripeConnect() {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 text-white">
            <LinkIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Stripe Connect</h2>
            <p className="text-sm text-zinc-500">Set up payouts so you can receive payments</p>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-800/50">
          <CreditCard className="mx-auto mb-3 h-10 w-10 text-zinc-400" />
          <p className="mb-1 font-medium">Connect your Stripe account</p>
          <p className="mb-4 text-sm text-zinc-500">
            You will be redirected to Stripe to complete the setup. You can always do this later from Settings.
          </p>
          <p className="text-xs text-zinc-400">
            Clicking &quot;Next&quot; will redirect you to Stripe.
          </p>
        </div>
      </div>
    );
  }

  function renderComplete() {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold">You&apos;re all set!</h2>
          <p className="mt-2 text-zinc-500">
            Your academy is configured and ready to go. You can always adjust these settings later.
          </p>
        </div>

        <div className="mx-auto grid max-w-sm gap-2 text-left text-sm">
          {STEPS.slice(0, -1).map((step) => (
            <div key={step.key} className="flex items-center gap-2">
              {completedSteps.has(step.key) ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <div className="h-4 w-4 rounded-full border border-zinc-300 dark:border-zinc-600" />
              )}
              <span className={completedSteps.has(step.key) ? "" : "text-zinc-400"}>{step.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderStepContent() {
    switch (STEPS[currentStep].key) {
      case "academy_setup":
        return renderAcademySetup();
      case "levels":
        return renderLevels();
      case "languages":
        return renderLanguages();
      case "plans":
        return renderPlans();
      case "stripe_connect":
        return renderStripeConnect();
      case "complete":
        return renderComplete();
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Onboarding</h1>
        <p className="text-sm text-zinc-500">
          Step {currentStep + 1} of {STEPS.length} &mdash; {STEPS[currentStep].label}
        </p>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-2 flex-1 rounded-full transition-colors",
              i <= currentStep ? "bg-gradient-accent" : "bg-zinc-200 dark:bg-zinc-700",
            )}
          />
        ))}
      </div>

      {/* Step content */}
      <div className="glass-subtle rounded-xl border border-zinc-200/40 p-8 dark:border-zinc-700/40">
        {renderStepContent()}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 0 || saving}
        >
          <ChevronLeft className="mr-1.5 h-4 w-4" />
          Back
        </Button>
        <Button onClick={handleNext} disabled={saving}>
          {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          {currentStep === STEPS.length - 1 ? "Go to Dashboard" : "Next"}
          {currentStep < STEPS.length - 1 && <ChevronRight className="ml-1.5 h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
