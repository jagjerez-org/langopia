"use client";

import { useState, useEffect } from "react";
import { User, Save, CreditCard, ExternalLink, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useAcademy } from "@/components/academy-provider";
import { useApiClient } from "@/hooks/use-api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface ConnectStatus {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const { selectedAcademy, selectedAcademyData } = useAcademy();
  const api = useApiClient();
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Stripe Connect
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectOnboarding, setConnectOnboarding] = useState(false);

  useEffect(() => {
    if (!selectedAcademy) return;
    setConnectLoading(true);
    api.stripe
      .connectStatus(selectedAcademy)
      .then(setConnectStatus)
      .catch(() => setConnectStatus(null))
      .finally(() => setConnectLoading(false));
  }, [selectedAcademy, api]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      await api.userProfile.update({ name: name.trim() });
      updateUser({ name: name.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleConnectOnboard() {
    if (!selectedAcademy) return;
    setConnectOnboarding(true);
    try {
      const result = await api.stripe.connectOnboard({ academyId: selectedAcademy });
      if (result.url) window.location.href = result.url;
    } catch {
      toast.error("Failed to start Stripe Connect onboarding");
      setConnectOnboarding(false);
    }
  }

  const isConnected = connectStatus?.chargesEnabled && connectStatus?.payoutsEnabled;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage your account and academy settings</p>
      </div>

      {/* Profile Section */}
      <div className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-zinc-600 to-zinc-700 text-white">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">Profile</h3>
            <p className="text-xs text-zinc-500">{user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Display Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Email</label>
            <Input value={user?.email ?? ""} disabled className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Plan</label>
            <div className="flex items-center gap-3">
              <Input
                value={(user?.plan ?? "free").charAt(0).toUpperCase() + (user?.plan ?? "free").slice(1)}
                disabled
                className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900"
              />
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/billing">Manage</Link>
              </Button>
            </div>
          </div>

          <Button type="submit" disabled={saving}>
            <Save className="mr-2 h-3.5 w-3.5" />
            {saved ? "Saved!" : saving ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </div>

      {/* Stripe Connect Section */}
      {selectedAcademy && (
        <div className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white">
              <CreditCard className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Stripe Connect — Payouts</h3>
              <p className="text-xs text-zinc-500">
                Receive payments from student subscriptions
              </p>
            </div>
            {!connectLoading && (
              <Badge
                variant="secondary"
                className={
                  isConnected
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                }
              >
                {isConnected ? "Connected" : "Not Connected"}
              </Badge>
            )}
          </div>

          {connectLoading ? (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking connection status...
            </div>
          ) : isConnected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="h-4 w-4" />
                <span>Your Stripe account is connected and ready to receive payouts</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg bg-zinc-50 p-3 text-center dark:bg-zinc-800">
                  <p className="text-xs text-zinc-500">Charges</p>
                  <p className="font-medium text-emerald-600">Enabled</p>
                </div>
                <div className="rounded-lg bg-zinc-50 p-3 text-center dark:bg-zinc-800">
                  <p className="text-xs text-zinc-500">Payouts</p>
                  <p className="font-medium text-emerald-600">Enabled</p>
                </div>
                <div className="rounded-lg bg-zinc-50 p-3 text-center dark:bg-zinc-800">
                  <p className="text-xs text-zinc-500">Details</p>
                  <p className="font-medium text-emerald-600">Submitted</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-4 w-4" />
                <span>
                  {connectStatus?.detailsSubmitted
                    ? "Your details are submitted but Stripe is still verifying your account"
                    : "Connect your Stripe account to start receiving student payments (2% platform fee)"}
                </span>
              </div>
              <Button
                onClick={handleConnectOnboard}
                disabled={connectOnboarding}
                className="bg-gradient-accent text-white"
              >
                {connectOnboarding ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="mr-2 h-4 w-4" />
                )}
                {connectStatus?.detailsSubmitted ? "Continue Setup" : "Connect with Stripe"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
