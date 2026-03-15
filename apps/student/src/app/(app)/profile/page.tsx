"use client";

import { useEffect, useState, useCallback } from "react";
import { getApiClient } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Flame, Zap, LogOut, Target, Globe, ChevronRight, User, Briefcase, Heart, GraduationCap, Languages } from "lucide-react";
import { EditSheet } from "@/components/edit-sheet";
import { LANGUAGES, getLanguageFlag, getLanguageName } from "@/lib/languages";
import { cn } from "@/lib/utils";
import type { StudentProfile, StudentProgressData } from "@langopia/api-client";

const GOALS = [
  { value: "travel", label: "Viajar" },
  { value: "work", label: "Trabajo" },
  { value: "study", label: "Estudios" },
  { value: "culture", label: "Cultura" },
  { value: "social", label: "Socializar" },
  { value: "immigration", label: "Emigración" },
];

const OCCUPATIONS = [
  { value: "student", label: "Estudiante" },
  { value: "professional", label: "Profesional" },
  { value: "freelancer", label: "Freelancer" },
  { value: "teacher", label: "Profesor/a" },
  { value: "retired", label: "Jubilado/a" },
  { value: "other", label: "Otro" },
];

const INTEREST_OPTIONS = [
  "music", "movies", "sports", "cooking", "technology",
  "travel", "art", "reading", "gaming", "nature",
  "fashion", "science", "history", "photography",
];

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const DAILY_GOALS = [5, 10, 15, 20, 30];

type SheetType = "name" | "learningLanguage" | "nativeLanguage" | "level" | "dailyGoal" | "learningGoal" | "occupation" | "interests" | null;

export default function ProfilePage() {
  const { logout } = useAuth();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [progress, setProgress] = useState<StudentProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSheet, setActiveSheet] = useState<SheetType>(null);
  const [nameInput, setNameInput] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  const loadProfile = useCallback(() => {
    const client = getApiClient();
    Promise.all([
      client.studentApp.profile().catch(() => null),
      client.studentApp.progress().catch(() => null),
    ])
      .then(([p, prog]) => {
        setProfile(p);
        setProgress(prog);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const openSheet = (type: SheetType) => {
    if (type === "name" && profile) setNameInput(profile.name);
    if (type === "interests" && profile) setSelectedInterests(profile.interests || []);
    setActiveSheet(type);
  };

  const savePreference = async (data: Record<string, unknown>) => {
    try {
      await getApiClient().studentApp.updatePreferences(data as never);
      setProfile((prev) => prev ? { ...prev, ...data } as StudentProfile : prev);
    } catch { /* ignore */ }
    setActiveSheet(null);
  };

  const saveName = async () => {
    if (!nameInput.trim()) return;
    try {
      await getApiClient().studentApp.updateProfile({ name: nameInput.trim() });
      setProfile((prev) => prev ? { ...prev, name: nameInput.trim() } : prev);
    } catch { /* ignore */ }
    setActiveSheet(null);
  };

  const switchLanguage = async (lang: string) => {
    try {
      await getApiClient().studentApp.switchLanguage({ learningLanguage: lang });
      setProfile((prev) => prev ? { ...prev, learningLanguage: lang } : prev);
    } catch { /* ignore */ }
    setActiveSheet(null);
  };

  if (loading || !profile) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const rows: { label: string; value: string; icon: React.ElementType; sheet: SheetType }[] = [
    { label: "Nombre", value: profile.name, icon: User, sheet: "name" },
    { label: "Idioma de aprendizaje", value: `${getLanguageFlag(profile.learningLanguage)} ${getLanguageName(profile.learningLanguage) || "No configurado"}`, icon: Globe, sheet: "learningLanguage" },
    { label: "Idioma nativo", value: `${getLanguageFlag(profile.nativeLanguage)} ${getLanguageName(profile.nativeLanguage) || "No configurado"}`, icon: Languages, sheet: "nativeLanguage" },
    { label: "Nivel", value: profile.selfAssessedLevel || "No configurado", icon: GraduationCap, sheet: "level" },
    { label: "Meta diaria", value: `${profile.dailyGoalMinutes} min`, icon: Target, sheet: "dailyGoal" },
    { label: "Meta de aprendizaje", value: GOALS.find((g) => g.value === profile.learningGoal)?.label || profile.learningGoal || "No configurado", icon: Heart, sheet: "learningGoal" },
    { label: "Ocupación", value: OCCUPATIONS.find((o) => o.value === profile.occupation)?.label || profile.occupation || "No configurado", icon: Briefcase, sheet: "occupation" },
    { label: "Intereses", value: profile.interests?.length ? profile.interests.join(", ") : "No configurados", icon: Heart, sheet: "interests" },
  ];

  return (
    <div className="px-2 py-6 md:px-3">
      {/* Profile header */}
      <div className="flex flex-col items-center text-center mb-6 animate-fade-in-up" style={{ "--stagger": 0 } as React.CSSProperties}>
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-4xl font-bold text-white shadow-lg">
          {profile.profileImageUrl ? (
            <img src={profile.profileImageUrl} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            profile.name.charAt(0).toUpperCase()
          )}
        </div>
        <h1 className="mt-3 font-display text-xl font-bold">{profile.name}</h1>
        <p className="text-sm text-muted-foreground">{profile.email}</p>
        {profile.selfAssessedLevel && (
          <span className="mt-2 rounded-full bg-primary/10 px-3 py-0.5 text-xs font-medium text-primary">
            Nivel {profile.selfAssessedLevel}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="animate-fade-in-up rounded-2xl bg-card p-4 text-center shadow-sm" style={{ "--stagger": 1 } as React.CSSProperties}>
          <Zap className="mx-auto mb-1.5 h-6 w-6 text-primary" />
          <div className="font-display text-lg font-bold">{profile.totalXp}</div>
          <div className="text-xs text-muted-foreground">XP total</div>
        </div>
        <div className="animate-fade-in-up rounded-2xl bg-card p-4 text-center shadow-sm" style={{ "--stagger": 2 } as React.CSSProperties}>
          <Flame className="mx-auto mb-1.5 h-6 w-6 text-orange-500 streak-glow" />
          <div className="font-display text-lg font-bold">{profile.streak.currentStreak}</div>
          <div className="text-xs text-muted-foreground">Racha</div>
        </div>
        <div className="animate-fade-in-up rounded-2xl bg-card p-4 text-center shadow-sm" style={{ "--stagger": 3 } as React.CSSProperties}>
          <span className="block text-2xl mb-0.5">{getLanguageFlag(profile.learningLanguage)}</span>
          <div className="font-display text-lg font-bold">{getLanguageName(profile.learningLanguage) || "—"}</div>
          <div className="text-xs text-muted-foreground">Idioma</div>
        </div>
      </div>

      {/* Activity heatmap */}
      {progress?.heatmap && progress.heatmap.length > 0 && (
        <div className="mb-6 rounded-2xl bg-card p-4 shadow-sm animate-fade-in-up" style={{ "--stagger": 4 } as React.CSSProperties}>
          <h3 className="mb-3 font-display text-sm font-semibold">Actividad</h3>
          <div className="flex flex-wrap gap-1">
            {progress.heatmap.slice(-84).map((day, i) => {
              const intensity = day.xp > 100 ? 4 : day.xp > 50 ? 3 : day.xp > 10 ? 2 : day.xp > 0 ? 1 : 0;
              const colors = ["bg-muted", "bg-primary/20", "bg-primary/40", "bg-primary/60", "bg-primary"];
              return (
                <div
                  key={i}
                  className={`h-3 w-3 rounded-sm ${colors[intensity]}`}
                  title={`${day.date}: ${day.xp} XP`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Editable preferences rows */}
      <div className="space-y-2 animate-fade-in-up" style={{ "--stagger": 5 } as React.CSSProperties}>
        {rows.map((row) => (
          <button
            key={row.label}
            onClick={() => openSheet(row.sheet)}
            className="flex w-full items-center justify-between rounded-2xl bg-card p-4 shadow-sm hover:bg-muted/50 transition-colors text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <row.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-sm">{row.label}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-primary truncate max-w-[160px]">{row.value}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
          </button>
        ))}

        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-sm text-destructive shadow-sm hover:bg-destructive/5 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>

      {/* Edit Sheets */}
      <EditSheet open={activeSheet === "name"} onClose={() => setActiveSheet(null)} title="Nombre">
        <input
          type="text"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          autoFocus
        />
        <button
          onClick={saveName}
          className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Guardar
        </button>
      </EditSheet>

      <EditSheet open={activeSheet === "learningLanguage"} onClose={() => setActiveSheet(null)} title="Idioma de aprendizaje">
        <div className="grid grid-cols-3 gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => switchLanguage(lang.code)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl p-3 text-sm transition-colors",
                profile.learningLanguage?.toLowerCase() === lang.code
                  ? "bg-primary/10 ring-2 ring-primary"
                  : "bg-muted hover:bg-muted/80",
              )}
            >
              <span className="text-2xl">{lang.flag}</span>
              <span className="text-xs font-medium">{lang.name}</span>
            </button>
          ))}
        </div>
      </EditSheet>

      <EditSheet open={activeSheet === "nativeLanguage"} onClose={() => setActiveSheet(null)} title="Idioma nativo">
        <div className="grid grid-cols-3 gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => savePreference({ nativeLanguage: lang.code })}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl p-3 text-sm transition-colors",
                profile.nativeLanguage?.toLowerCase() === lang.code
                  ? "bg-primary/10 ring-2 ring-primary"
                  : "bg-muted hover:bg-muted/80",
              )}
            >
              <span className="text-2xl">{lang.flag}</span>
              <span className="text-xs font-medium">{lang.name}</span>
            </button>
          ))}
        </div>
      </EditSheet>

      <EditSheet open={activeSheet === "level"} onClose={() => setActiveSheet(null)} title="Nivel">
        <div className="flex flex-wrap gap-2">
          {LEVELS.map((level) => (
            <button
              key={level}
              onClick={() => savePreference({ selfAssessedLevel: level })}
              className={cn(
                "rounded-full px-5 py-2.5 text-sm font-semibold transition-colors",
                profile.selfAssessedLevel === level
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80",
              )}
            >
              {level}
            </button>
          ))}
        </div>
      </EditSheet>

      <EditSheet open={activeSheet === "dailyGoal"} onClose={() => setActiveSheet(null)} title="Meta diaria">
        <div className="flex flex-wrap gap-2">
          {DAILY_GOALS.map((mins) => (
            <button
              key={mins}
              onClick={() => savePreference({ dailyGoalMinutes: mins })}
              className={cn(
                "rounded-full px-5 py-2.5 text-sm font-semibold transition-colors",
                profile.dailyGoalMinutes === mins
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80",
              )}
            >
              {mins} min
            </button>
          ))}
        </div>
      </EditSheet>

      <EditSheet open={activeSheet === "learningGoal"} onClose={() => setActiveSheet(null)} title="Meta de aprendizaje">
        <div className="flex flex-wrap gap-2">
          {GOALS.map((goal) => (
            <button
              key={goal.value}
              onClick={() => savePreference({ learningGoal: goal.value })}
              className={cn(
                "rounded-full px-5 py-2.5 text-sm font-semibold transition-colors",
                profile.learningGoal === goal.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80",
              )}
            >
              {goal.label}
            </button>
          ))}
        </div>
      </EditSheet>

      <EditSheet open={activeSheet === "occupation"} onClose={() => setActiveSheet(null)} title="Ocupación">
        <div className="flex flex-wrap gap-2">
          {OCCUPATIONS.map((occ) => (
            <button
              key={occ.value}
              onClick={() => savePreference({ occupation: occ.value })}
              className={cn(
                "rounded-full px-5 py-2.5 text-sm font-semibold transition-colors",
                profile.occupation === occ.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80",
              )}
            >
              {occ.label}
            </button>
          ))}
        </div>
      </EditSheet>

      <EditSheet open={activeSheet === "interests"} onClose={() => setActiveSheet(null)} title="Intereses">
        <div className="flex flex-wrap gap-2">
          {INTEREST_OPTIONS.map((interest) => (
            <button
              key={interest}
              onClick={() => {
                setSelectedInterests((prev) =>
                  prev.includes(interest)
                    ? prev.filter((i) => i !== interest)
                    : [...prev, interest],
                );
              }}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors capitalize",
                selectedInterests.includes(interest)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80",
              )}
            >
              {interest}
            </button>
          ))}
        </div>
        <button
          onClick={() => savePreference({ interests: selectedInterests })}
          className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Guardar
        </button>
      </EditSheet>
    </div>
  );
}
