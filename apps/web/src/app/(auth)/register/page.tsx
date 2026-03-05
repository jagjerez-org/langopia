"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { createPublicClient } from "@/hooks/use-api-client";
import { ApiError } from "@langopia/api-client";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    try {
      const api = createPublicClient();
      await api.auth.register({ name, email, password });
      router.push("/login?registered=true");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="glass animate-fade-in-up rounded-2xl p-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          Create an account
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Get started with Langopia
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-medium">
            Name
          </Label>
          <Input
            id="name"
            name="name"
            type="text"
            placeholder="Your name"
            required
            className="rounded-xl border-zinc-200/60 bg-white/50 py-5 backdrop-blur-sm transition-all focus:bg-white/80 dark:border-zinc-700/60 dark:bg-zinc-800/50 dark:focus:bg-zinc-800/80"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium">
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            className="rounded-xl border-zinc-200/60 bg-white/50 py-5 backdrop-blur-sm transition-all focus:bg-white/80 dark:border-zinc-700/60 dark:bg-zinc-800/50 dark:focus:bg-zinc-800/80"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium">
            Password
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="At least 8 characters"
            required
            minLength={8}
            className="rounded-xl border-zinc-200/60 bg-white/50 py-5 backdrop-blur-sm transition-all focus:bg-white/80 dark:border-zinc-700/60 dark:bg-zinc-800/50 dark:focus:bg-zinc-800/80"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-sm font-medium">
            Confirm Password
          </Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            placeholder="Confirm your password"
            required
            className="rounded-xl border-zinc-200/60 bg-white/50 py-5 backdrop-blur-sm transition-all focus:bg-white/80 dark:border-zinc-700/60 dark:bg-zinc-800/50 dark:focus:bg-zinc-800/80"
          />
        </div>

        <Button
          type="submit"
          className="bg-gradient-accent w-full rounded-xl py-5 font-semibold text-white shadow-md transition-all hover:shadow-lg hover:brightness-110"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-gradient font-semibold hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
