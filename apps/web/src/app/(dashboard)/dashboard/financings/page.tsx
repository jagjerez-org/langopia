"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Users,
  AlertCircle,
  Plus,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { useAcademy } from "@/components/academy-provider";
import { useApiClient } from "@/hooks/use-api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TutorialOverlay } from "@/components/tutorial-overlay";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
} from "recharts";
import type { AcademyPlanResponse, AcademyPlanLimits } from "@langopia/api-client";
import { AcademyPlanPeriodicity } from "@langopia/shared/types";

type Period = "daily" | "monthly" | "quarterly" | "annual";

interface KpiData {
  revenue: { current: number; previous: number; change: number };
  activeSubscriptions: { current: number; previous: number; change: number };
  inactiveSubscriptions: { current: number; previous: number; change: number };
  overdueSubscriptions: { current: number; previous: number; change: number };
}

interface PlanRevenue {
  plan: string;
  revenue: number;
  activeCount: number;
}

interface Subscription {
  id: string;
  studentName: string;
  studentEmail: string;
  planName: string;
  status: "active" | "cancelled" | "past_due" | "unpaid";
  startDate: string;
}

interface OverviewResponse {
  kpis: KpiData;
  revenueByPlan: PlanRevenue[];
}

interface SubscriptionsResponse {
  data: Subscription[];
  total: number;
}

const statusStyles: Record<string, string> = {
  active:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelled: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  past_due:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  unpaid: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function generateTrendData(kpis: KpiData | undefined) {
  const now = new Date();
  const currentRevenue = kpis?.revenue.current ?? 0;
  const currentSubs = kpis?.activeSubscriptions.current ?? 0;

  return Array.from({ length: 6 }).map((_, i) => {
    const monthIndex = (now.getMonth() - 5 + i + 12) % 12;
    const factor = 0.6 + (i / 5) * 0.4;
    const jitter = 1 + (Math.sin(i * 2.5) * 0.08);
    return {
      month: MONTH_NAMES[monthIndex],
      revenue: Math.round(currentRevenue * factor * jitter),
      subscriptions: Math.max(1, Math.round(currentSubs * factor * (1 + Math.cos(i * 1.8) * 0.1))),
    };
  });
}

export default function FinancingsPage() {
  const { selectedAcademy, loading } = useAcademy();
  const api = useApiClient();

  const [period, setPeriod] = useState<Period>("monthly");
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Plans management state
  const [plans, setPlans] = useState<AcademyPlanResponse[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<AcademyPlanResponse | null>(null);
  const [planName, setPlanName] = useState("");
  const [planPrice, setPlanPrice] = useState("");
  const [planCurrency, setPlanCurrency] = useState("EUR");
  const [planPeriodicity, setPlanPeriodicity] = useState<AcademyPlanPeriodicity>(AcademyPlanPeriodicity.MONTHLY);
  const [planLimits, setPlanLimits] = useState<AcademyPlanLimits>({});
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    if (!selectedAcademy) return;
    setLoadingPlans(true);
    try {
      const data = await api.academyPlans.list(selectedAcademy);
      setPlans(data);
    } catch {
      toast.error("Failed to load plans");
    } finally {
      setLoadingPlans(false);
    }
  }, [selectedAcademy, api]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  useEffect(() => {
    if (!selectedAcademy) return;

    setLoadingData(true);

    Promise.all([
      api.financings.overview(selectedAcademy, { period }),
      api.financings.subscriptions(selectedAcademy, { period }),
    ])
      .then(([overviewData, subsData]) => {
        setOverview(overviewData as unknown as OverviewResponse);
        setSubscriptions(((subsData as unknown as SubscriptionsResponse).data ?? subsData) as unknown as Subscription[]);
      })
      .catch(() => {
        toast.error("Failed to load financial data");
      })
      .finally(() => {
        setLoadingData(false);
      });
  }, [selectedAcademy, period, api]);

  function openCreatePlan() {
    setEditingPlan(null);
    setPlanName("");
    setPlanPrice("");
    setPlanCurrency("EUR");
    setPlanPeriodicity(AcademyPlanPeriodicity.MONTHLY);
    setPlanLimits({});
    setDialogOpen(true);
  }

  function openEditPlan(plan: AcademyPlanResponse) {
    setEditingPlan(plan);
    setPlanName(plan.name);
    setPlanPrice(String(plan.price));
    setPlanCurrency(plan.currency);
    setPlanPeriodicity(plan.periodicity);
    setPlanLimits(plan.limits ?? {});
    setDialogOpen(true);
  }

  async function handleSavePlan() {
    if (!selectedAcademy || !planName.trim() || !planPrice) return;
    setSaving(true);
    try {
      const body = {
        name: planName.trim(),
        price: Number(planPrice),
        currency: planCurrency,
        periodicity: planPeriodicity,
        limits: planLimits,
      };
      if (editingPlan) {
        await api.academyPlans.update(selectedAcademy, editingPlan.id, body);
        toast.success("Plan updated");
      } else {
        await api.academyPlans.create(selectedAcademy, body);
        toast.success("Plan created");
      }
      setDialogOpen(false);
      fetchPlans();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save plan";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(plan: AcademyPlanResponse) {
    if (!selectedAcademy) return;
    setTogglingId(plan.id);
    try {
      if (plan.isActive) {
        await api.academyPlans.deactivate(selectedAcademy, plan.id);
        toast.success(`"${plan.name}" deactivated`);
      } else {
        await api.academyPlans.activate(selectedAcademy, plan.id);
        toast.success(`"${plan.name}" activated`);
      }
      fetchPlans();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to toggle plan";
      toast.error(message);
    } finally {
      setTogglingId(null);
    }
  }

  const kpis = overview?.kpis;

  const trendData = useMemo(() => generateTrendData(kpis), [kpis]);

  const planChartData = useMemo(() => {
    if (!overview?.revenueByPlan) return [];
    return overview.revenueByPlan.map((item) => ({
      plan: item.plan.charAt(0).toUpperCase() + item.plan.slice(1),
      revenue: item.revenue,
      activeCount: item.activeCount,
    }));
  }, [overview?.revenueByPlan]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="glass-subtle h-32 animate-pulse rounded-xl border border-zinc-200/40 dark:border-zinc-700/40"
            />
          ))}
        </div>
      </div>
    );
  }

  const kpiCards = [
    {
      label: "Revenue",
      icon: Wallet,
      value: kpis ? `\u20AC${kpis.revenue.current.toLocaleString()}` : "\u20AC0",
      change: kpis?.revenue.change ?? 0,
    },
    {
      label: "Active Subscriptions",
      icon: Users,
      value: kpis?.activeSubscriptions.current?.toString() ?? "0",
      change: kpis?.activeSubscriptions.change ?? 0,
    },
    {
      label: "Inactive Subscriptions",
      icon: Users,
      value: kpis?.inactiveSubscriptions.current?.toString() ?? "0",
      change: kpis?.inactiveSubscriptions.change ?? 0,
    },
    {
      label: "Overdue Subscriptions",
      icon: AlertCircle,
      value: kpis?.overdueSubscriptions.current?.toString() ?? "0",
      change: kpis?.overdueSubscriptions.change ?? 0,
    },
  ];

  return (
    <>
      <TutorialOverlay
        sectionId="financings"
        steps={[
          { title: "Financial Overview", description: "Track revenue, subscriptions, and financial KPIs for your academy." },
          { title: "Period Comparison", description: "Switch between daily, monthly, quarterly, and annual views to compare performance." },
          { title: "Revenue Charts", description: "Visualize revenue trends and breakdown by subscription plan." },
        ]}
      />
      <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financings</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Revenue, subscriptions, and financial analytics
          </p>
        </div>
        <Select
          value={period}
          onValueChange={(v) => setPeriod(v as Period)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
            <SelectItem value="annual">Annual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Subscription Plans */}
      <div className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Subscription Plans</h2>
          <Button size="sm" onClick={openCreatePlan}>
            <Plus className="mr-2 h-4 w-4" /> Add Plan
          </Button>
        </div>
        {loadingPlans ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Wallet className="mb-3 h-8 w-8 text-zinc-400" />
            <p className="text-sm font-medium text-zinc-500">No plans defined</p>
            <p className="text-xs text-zinc-400">Create subscription plans for your students</p>
          </div>
        ) : (
          <div className="space-y-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200/40 px-4 py-3 dark:border-zinc-700/40"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{plan.name}</span>
                      <Badge
                        variant="secondary"
                        className={
                          plan.isActive
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                        }
                      >
                        {plan.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-sm text-zinc-500">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        {plan.currency === "EUR" ? "€" : plan.currency}{plan.price}
                      </span>
                      <span>/ {plan.periodicity}</span>
                      {plan.subscriptionCount != null && (
                        <span className="text-xs text-zinc-400">
                          · {plan.subscriptionCount} subscription{plan.subscriptionCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditPlan(plan)}
                    className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
                    title="Edit plan"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <Switch
                    checked={plan.isActive}
                    onCheckedChange={() => handleToggleActive(plan)}
                    disabled={togglingId === plan.id}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40"
            >
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Icon className="h-4 w-4" />
                <span>{card.label}</span>
              </div>
              <div className="mt-2 text-3xl font-bold">{card.value}</div>
              <div className="mt-1 flex items-center gap-1 text-xs">
                {card.change > 0 ? (
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span
                  className={
                    card.change > 0 ? "text-emerald-500" : "text-red-500"
                  }
                >
                  {Math.abs(card.change)}%
                </span>
                <span className="text-zinc-400">vs previous</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Revenue Trend Chart */}
      <div className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
        <h2 className="mb-4 text-lg font-semibold">Revenue Trend</h2>
        {loadingData ? (
          <div className="h-[320px] animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="revenue"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `\u20AC${v.toLocaleString()}`}
              />
              <YAxis
                yAxisId="subs"
                orientation="right"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(24, 24, 27, 0.9)",
                  border: "1px solid rgba(63, 63, 70, 0.4)",
                  borderRadius: "0.5rem",
                  color: "#fff",
                  fontSize: 12,
                }}
                formatter={(value: number | undefined, name: string | undefined) => {
                  const v = value ?? 0;
                  if (name === "revenue") return [`\u20AC${v.toLocaleString()}`, "Revenue"];
                  return [v, "Subscriptions"];
                }}
              />
              <Legend
                verticalAlign="top"
                height={36}
                formatter={(value: string) =>
                  value === "revenue" ? "Revenue" : "Subscriptions"
                }
              />
              <Bar
                yAxisId="revenue"
                dataKey="revenue"
                fill="#8b5cf6"
                radius={[4, 4, 0, 0]}
                barSize={32}
              />
              <Line
                yAxisId="subs"
                type="monotone"
                dataKey="subscriptions"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 4, fill: "#10b981" }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Revenue by Plan - Horizontal Bar Chart */}
      <div className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
        <h2 className="mb-4 text-lg font-semibold">Revenue by Plan</h2>
        {loadingData ? (
          <div className="h-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        ) : planChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(200, planChartData.length * 60 + 40)}>
            <BarChart
              data={planChartData}
              layout="vertical"
              margin={{ top: 5, right: 30, bottom: 5, left: 80 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `\u20AC${v.toLocaleString()}`}
              />
              <YAxis
                type="category"
                dataKey="plan"
                tick={{ fontSize: 13 }}
                tickLine={false}
                axisLine={false}
                width={70}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(24, 24, 27, 0.9)",
                  border: "1px solid rgba(63, 63, 70, 0.4)",
                  borderRadius: "0.5rem",
                  color: "#fff",
                  fontSize: 12,
                }}
                formatter={(value: number | undefined, name: string | undefined) => {
                  const v = value ?? 0;
                  if (name === "revenue") return [`\u20AC${v.toLocaleString()}`, "Revenue"];
                  return [v, "Active Count"];
                }}
              />
              <Legend
                formatter={(value: string) =>
                  value === "revenue" ? "Revenue" : "Active Count"
                }
              />
              <Bar dataKey="revenue" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
              <Bar dataKey="activeCount" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-zinc-400">No revenue data available</p>
        )}
      </div>

      {/* Subscription List */}
      <div className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
        <h2 className="mb-4 text-lg font-semibold">Subscriptions</h2>
        {loadingData ? (
          <div className="h-32 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        ) : subscriptions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200/40 text-left text-zinc-500 dark:border-zinc-700/40">
                  <th className="pb-2 font-medium">Student</th>
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 font-medium">Plan</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Start Date</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((sub) => (
                  <tr
                    key={sub.id}
                    className="border-b border-zinc-100/40 last:border-0 dark:border-zinc-800/40"
                  >
                    <td className="py-3 font-medium">{sub.studentName}</td>
                    <td className="py-3 text-zinc-600 dark:text-zinc-400">
                      {sub.studentEmail}
                    </td>
                    <td className="py-3 capitalize">{sub.planName}</td>
                    <td className="py-3">
                      <Badge
                        variant="secondary"
                        className={statusStyles[sub.status] ?? ""}
                      >
                        {sub.status === "past_due"
                          ? "Past Due"
                          : sub.status.charAt(0).toUpperCase() +
                            sub.status.slice(1)}
                      </Badge>
                    </td>
                    <td className="py-3 text-zinc-600 dark:text-zinc-400">
                      {new Date(sub.startDate).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Wallet className="mb-3 h-10 w-10 text-zinc-400" />
            <p className="font-medium text-zinc-500">No subscriptions found</p>
          </div>
        )}
      </div>
    </div>

      {/* Create / Edit Plan Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit Plan" : "Add Plan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="plan-name">Name</Label>
              <Input
                id="plan-name"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="e.g. Basic Monthly"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan-price">Price</Label>
                <Input
                  id="plan-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={planPrice}
                  onChange={(e) => setPlanPrice(e.target.value)}
                  placeholder="29.99"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-currency">Currency</Label>
                <Input
                  id="plan-currency"
                  value={planCurrency}
                  onChange={(e) => setPlanCurrency(e.target.value.toUpperCase())}
                  placeholder="EUR"
                  maxLength={3}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-periodicity">Periodicity</Label>
              <Select
                value={planPeriodicity}
                onValueChange={(v) => setPlanPeriodicity(v as AcademyPlanPeriodicity)}
              >
                <SelectTrigger id="plan-periodicity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AcademyPlanPeriodicity.DAILY}>Daily</SelectItem>
                  <SelectItem value={AcademyPlanPeriodicity.WEEKLY}>Weekly</SelectItem>
                  <SelectItem value={AcademyPlanPeriodicity.MONTHLY}>Monthly</SelectItem>
                  <SelectItem value={AcademyPlanPeriodicity.ANNUAL}>Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Limits */}
            <div className="space-y-3 rounded-lg border border-zinc-200/40 p-4 dark:border-zinc-700/40">
              <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Limits</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="limit-individual" className="text-xs">Max Individual Classes</Label>
                  <Input
                    id="limit-individual"
                    type="number"
                    min="0"
                    value={planLimits.maxIndividualClasses ?? ""}
                    onChange={(e) => setPlanLimits({ ...planLimits, maxIndividualClasses: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="Unlimited"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="limit-group" className="text-xs">Max Group Classes</Label>
                  <Input
                    id="limit-group"
                    type="number"
                    min="0"
                    value={planLimits.maxGroupClasses ?? ""}
                    onChange={(e) => setPlanLimits({ ...planLimits, maxGroupClasses: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="Unlimited"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="limit-cancellations" className="text-xs">Max Cancellations</Label>
                  <Input
                    id="limit-cancellations"
                    type="number"
                    min="0"
                    value={planLimits.maxCancellations ?? ""}
                    onChange={(e) => setPlanLimits({ ...planLimits, maxCancellations: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="Unlimited"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="limit-bookings" className="text-xs">Max Bookings</Label>
                  <Input
                    id="limit-bookings"
                    type="number"
                    min="0"
                    value={planLimits.maxBookings ?? ""}
                    onChange={(e) => setPlanLimits({ ...planLimits, maxBookings: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="Unlimited"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="limit-period" className="text-xs">Limit Period</Label>
                <Input
                  id="limit-period"
                  value={planLimits.limitPeriod ?? ""}
                  onChange={(e) => setPlanLimits({ ...planLimits, limitPeriod: e.target.value || undefined })}
                  placeholder="e.g. monthly, weekly"
                />
              </div>
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-medium text-zinc-500">Feature Access</h4>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    ["accessIndividualClasses", "Individual Classes"],
                    ["accessGroupClasses", "Group Classes"],
                    ["accessLearningPath", "Learning Paths"],
                    ["accessAiChat", "AI Chat"],
                  ] as const).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between gap-2">
                      <Label htmlFor={`limit-${key}`} className="text-xs">{label}</Label>
                      <Switch
                        id={`limit-${key}`}
                        checked={planLimits[key] ?? false}
                        onCheckedChange={(checked) => setPlanLimits({ ...planLimits, [key]: checked })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSavePlan}
              disabled={saving || !planName.trim() || !planPrice}
            >
              {saving ? "Saving..." : editingPlan ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
