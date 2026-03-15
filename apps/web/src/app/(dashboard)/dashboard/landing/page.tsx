"use client";

import { useState, useEffect } from "react";
import { Globe, Save, Eye, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useAcademy } from "@/components/academy-provider";
import { useApiClient } from "@/hooks/use-api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

interface AcademyLandingResponse {
  id: string;
  academyId: string;
  logoUrl: string | null;
  primaryColor: string;
  backgroundColor: string;
  heroTitle: string | null;
  heroDescription: string | null;
  heroImageUrl: string | null;
  showPlans: boolean;
  showTeacherApplication: boolean;
  isPublished: boolean;
}

export default function LandingPage() {
  const { selectedAcademy, selectedAcademyData } = useAcademy();
  const api = useApiClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [isPublished, setIsPublished] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#6366f1");
  const [backgroundColor, setBackgroundColor] = useState("#f8fafc");
  const [heroTitle, setHeroTitle] = useState("");
  const [heroDescription, setHeroDescription] = useState("");
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [showPlans, setShowPlans] = useState(true);
  const [showTeacherApplication, setShowTeacherApplication] = useState(true);

  const slug =
    selectedAcademyData?.slug ??
    (selectedAcademyData?.name ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  useEffect(() => {
    if (!selectedAcademy) return;
    setLoading(true);
    api.academyLanding
      .get(selectedAcademy)
      .then((data: AcademyLandingResponse) => {
        setIsPublished(data.isPublished);
        setLogoUrl(data.logoUrl ?? "");
        setPrimaryColor(data.primaryColor);
        setBackgroundColor(data.backgroundColor);
        setHeroTitle(data.heroTitle ?? "");
        setHeroDescription(data.heroDescription ?? "");
        setHeroImageUrl(data.heroImageUrl ?? "");
        setShowPlans(data.showPlans);
        setShowTeacherApplication(data.showTeacherApplication);
      })
      .catch(() => {
        toast.error("Failed to load landing page configuration");
      })
      .finally(() => setLoading(false));
  }, [selectedAcademy, api]);

  async function handleSave() {
    if (!selectedAcademy) return;
    setSaving(true);
    try {
      await api.academyLanding.update(selectedAcademy, {
        isPublished,
        logoUrl: logoUrl || undefined,
        primaryColor,
        backgroundColor,
        heroTitle: heroTitle || undefined,
        heroDescription: heroDescription || undefined,
        heroImageUrl: heroImageUrl || undefined,
        showPlans,
        showTeacherApplication,
      });
      toast.success("Landing page settings saved");
    } catch {
      toast.error("Failed to save landing page settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Landing Page</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Configure your academy&apos;s public landing page
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch checked={isPublished} onCheckedChange={setIsPublished} />
            <Badge
              variant="secondary"
              className={
                isPublished
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              }
            >
              {isPublished ? "Published" : "Draft"}
            </Badge>
          </div>
          {slug && (
            <Button variant="outline" size="sm" asChild>
              <a
                href={`/academy/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Eye className="mr-1.5 h-3.5 w-3.5" />
                Preview
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Branding Section */}
      <div className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">Branding</h3>
            <p className="text-xs text-zinc-500">
              Customize the look and feel of your landing page
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Logo URL
            </label>
            <Input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Primary Color
            </label>
            <div className="flex items-center gap-2">
              <div
                className="h-8 w-8 rounded-md border"
                style={{ backgroundColor: primaryColor }}
              />
              <Input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#6366f1"
                className="w-28"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Background Color
            </label>
            <div className="flex items-center gap-2">
              <div
                className="h-8 w-8 rounded-md border"
                style={{ backgroundColor: backgroundColor }}
              />
              <Input
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                placeholder="#f8fafc"
                className="w-28"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white">
            <ExternalLink className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">Hero Section</h3>
            <p className="text-xs text-zinc-500">
              The first thing visitors see on your landing page
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Hero Title
            </label>
            <Input
              value={heroTitle}
              onChange={(e) => setHeroTitle(e.target.value)}
              placeholder="Welcome to our academy"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Hero Description
            </label>
            <textarea
              value={heroDescription}
              onChange={(e) => setHeroDescription(e.target.value)}
              placeholder="Describe your academy and what makes it special..."
              rows={3}
              className="w-full rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:border-zinc-800 dark:placeholder:text-zinc-400 dark:focus-visible:ring-zinc-300"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Hero Image URL
            </label>
            <Input
              value={heroImageUrl}
              onChange={(e) => setHeroImageUrl(e.target.value)}
              placeholder="https://example.com/hero.jpg"
            />
          </div>
        </div>
      </div>

      {/* Display Options */}
      <div className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
        <div className="mb-5">
          <h3 className="font-semibold">Display Options</h3>
          <p className="text-xs text-zinc-500">
            Choose which sections to show on your landing page
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Show Subscription Plans</p>
              <p className="text-xs text-zinc-500">
                Display available plans and pricing on your landing page
              </p>
            </div>
            <Switch checked={showPlans} onCheckedChange={setShowPlans} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                Show Teacher Application Form
              </p>
              <p className="text-xs text-zinc-500">
                Allow teachers to apply to join your academy
              </p>
            </div>
            <Switch
              checked={showTeacherApplication}
              onCheckedChange={setShowTeacherApplication}
            />
          </div>
        </div>
      </div>

      {/* Preview Link & Save */}
      <div className="flex items-center justify-between">
        {slug && (
          <a
            href={`/academy/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            /academy/{slug}
          </a>
        )}
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="mr-2 h-3.5 w-3.5" />
          )}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
