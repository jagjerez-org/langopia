"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getApiClient } from "@/lib/api";
import { EXERCISE_LANGUAGES } from "@langopia/shared/types";
import { ChevronLeft, Check, Flame } from "lucide-react";

const STEPS = [
  "native_language",
  "learning_language",
  "level",
  "goal",
  "occupation",
  "interests",
  "daily_goal",
  "referral",
] as const;

const LEVELS = [
  { value: "A1", label: "Beginner", desc: "I know a few words" },
  { value: "A2", label: "Elementary", desc: "I can handle basic conversations" },
  { value: "B1", label: "Intermediate", desc: "I can discuss familiar topics" },
  { value: "B2", label: "Upper-Intermediate", desc: "I can interact with fluency" },
  { value: "C1", label: "Advanced", desc: "I can express complex ideas" },
  { value: "C2", label: "Proficient", desc: "I understand virtually everything" },
];

const GOALS = [
  { value: "travel", label: "Travel", icon: "✈️" },
  { value: "work", label: "Work", icon: "💼" },
  { value: "studies", label: "Studies", icon: "📚" },
  { value: "culture", label: "Culture", icon: "🎭" },
  { value: "immigration", label: "Immigration", icon: "🌍" },
  { value: "social", label: "Social", icon: "💬" },
  { value: "other", label: "Other", icon: "✨" },
];

const OCCUPATIONS = [
  { value: "student", label: "Student" },
  { value: "professional", label: "Professional" },
  { value: "freelancer", label: "Freelancer" },
  { value: "business_owner", label: "Business Owner" },
  { value: "retired", label: "Retired" },
  { value: "other", label: "Other" },
];

const INTERESTS = [
  "Technology", "Music", "Sports", "Movies", "Food", "Travel",
  "Science", "Art", "Business", "Health", "Fashion", "Gaming",
  "History", "Nature", "Photography", "Literature",
];

const DAILY_GOALS = [
  { value: 5, label: "5 min", desc: "Casual" },
  { value: 10, label: "10 min", desc: "Regular" },
  { value: 15, label: "15 min", desc: "Committed" },
  { value: 20, label: "20 min", desc: "Serious" },
  { value: 30, label: "30 min", desc: "Intense" },
];

const REFERRALS = [
  { value: "friend", label: "Friend" },
  { value: "social_media", label: "Social media" },
  { value: "search", label: "Search engine" },
  { value: "ad", label: "Advertisement" },
  { value: "other", label: "Other" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Selections
  const [nativeLanguage, setNativeLanguage] = useState("");
  const [learningLanguage, setLearningLanguage] = useState("");
  const [level, setLevel] = useState("");
  const [goal, setGoal] = useState("");
  const [occupation, setOccupation] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [dailyGoal, setDailyGoal] = useState(15);
  const [referral, setReferral] = useState("");

  const currentStep = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;

  function toggleInterest(interest: string) {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : prev.length < 5
          ? [...prev, interest]
          : prev,
    );
  }

  function next() {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      submit();
    }
  }

  function back() {
    if (step > 0) setStep(step - 1);
  }

  async function submit() {
    setSubmitting(true);
    try {
      const client = getApiClient();
      await client.studentApp.saveOnboarding({
        nativeLanguage,
        learningLanguage,
        selfAssessedLevel: level,
        learningGoal: goal,
        occupation,
        interests,
        dailyGoalMinutes: dailyGoal,
        referralSource: referral,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      router.push("/home");
    } catch {
      // Silently continue to home on error
      router.push("/home");
    }
  }

  function canContinue(): boolean {
    switch (currentStep) {
      case "native_language": return !!nativeLanguage;
      case "learning_language": return !!learningLanguage;
      case "level": return !!level;
      case "goal": return !!goal;
      case "occupation": return !!occupation;
      case "interests": return interests.length >= 1;
      case "daily_goal": return !!dailyGoal;
      case "referral": return true; // optional
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Progress bar */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center px-4 py-3">
          {step > 0 ? (
            <button onClick={back} className="p-1 text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <div className="w-7" />
          )}
          <span className="flex-1 text-center text-sm text-muted-foreground">
            {step + 1} of {STEPS.length}
          </span>
          <button
            onClick={next}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Skip
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col px-4 pb-24 pt-8">
        {currentStep === "native_language" && (
          <StepContainer title="What's your native language?">
            <div className="grid grid-cols-2 gap-3">
              {EXERCISE_LANGUAGES.map((lang) => (
                <SelectButton
                  key={lang.code}
                  selected={nativeLanguage === lang.code}
                  onClick={() => setNativeLanguage(lang.code)}
                >
                  {lang.name}
                </SelectButton>
              ))}
            </div>
          </StepContainer>
        )}

        {currentStep === "learning_language" && (
          <StepContainer title="What language do you want to learn?">
            <div className="grid grid-cols-2 gap-3">
              {EXERCISE_LANGUAGES.filter((l) => l.code !== nativeLanguage).map((lang) => (
                <SelectButton
                  key={lang.code}
                  selected={learningLanguage === lang.code}
                  onClick={() => setLearningLanguage(lang.code)}
                >
                  {lang.name}
                </SelectButton>
              ))}
            </div>
          </StepContainer>
        )}

        {currentStep === "level" && (
          <StepContainer title="What's your current level?">
            <div className="space-y-3">
              {LEVELS.map((l) => (
                <SelectButton
                  key={l.value}
                  selected={level === l.value}
                  onClick={() => setLevel(l.value)}
                  className="w-full text-left"
                >
                  <div>
                    <div className="font-medium">{l.label}</div>
                    <div className="text-xs text-muted-foreground">{l.desc}</div>
                  </div>
                </SelectButton>
              ))}
            </div>
          </StepContainer>
        )}

        {currentStep === "goal" && (
          <StepContainer title="Why are you learning?">
            <div className="grid grid-cols-2 gap-3">
              {GOALS.map((g) => (
                <SelectButton
                  key={g.value}
                  selected={goal === g.value}
                  onClick={() => setGoal(g.value)}
                >
                  <span className="mr-2 text-lg">{g.icon}</span>
                  {g.label}
                </SelectButton>
              ))}
            </div>
          </StepContainer>
        )}

        {currentStep === "occupation" && (
          <StepContainer title="What do you do?">
            <div className="grid grid-cols-2 gap-3">
              {OCCUPATIONS.map((o) => (
                <SelectButton
                  key={o.value}
                  selected={occupation === o.value}
                  onClick={() => setOccupation(o.value)}
                >
                  {o.label}
                </SelectButton>
              ))}
            </div>
          </StepContainer>
        )}

        {currentStep === "interests" && (
          <StepContainer title="Pick 3-5 topics you enjoy">
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((interest) => (
                <button
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                    interests.includes(interest)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {interests.includes(interest) && <Check className="mr-1 inline h-3 w-3" />}
                  {interest}
                </button>
              ))}
            </div>
          </StepContainer>
        )}

        {currentStep === "daily_goal" && (
          <StepContainer title="How much time per day?">
            <div className="space-y-3">
              {DAILY_GOALS.map((dg) => (
                <SelectButton
                  key={dg.value}
                  selected={dailyGoal === dg.value}
                  onClick={() => setDailyGoal(dg.value)}
                  className="w-full"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium">{dg.label}</span>
                    <span className="text-xs text-muted-foreground">{dg.desc}</span>
                  </div>
                </SelectButton>
              ))}
            </div>
          </StepContainer>
        )}

        {currentStep === "referral" && (
          <StepContainer title="How did you hear about us?">
            <div className="grid grid-cols-2 gap-3">
              {REFERRALS.map((r) => (
                <SelectButton
                  key={r.value}
                  selected={referral === r.value}
                  onClick={() => setReferral(r.value)}
                >
                  {r.label}
                </SelectButton>
              ))}
            </div>
          </StepContainer>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 bg-background/80 px-4 pb-4 pt-2 backdrop-blur-sm">
        <button
          onClick={next}
          disabled={!canContinue() || submitting}
          className="w-full rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {step === STEPS.length - 1
            ? submitting
              ? "Setting up..."
              : "Let's go!"
            : "Continue"}
        </button>
      </div>
    </div>
  );
}

function StepContainer({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      <h2 className="mb-6 text-xl font-bold">{title}</h2>
      {children}
    </div>
  );
}

function SelectButton({
  selected,
  onClick,
  children,
  className = "",
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center rounded-xl border-2 px-4 py-3 text-sm transition-colors ${
        selected
          ? "border-primary bg-primary/5 font-medium"
          : "border-border hover:border-primary/40"
      } ${className}`}
    >
      {children}
    </button>
  );
}
