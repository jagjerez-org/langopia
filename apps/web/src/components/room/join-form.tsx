"use client";

import { useState } from "react";
import { GraduationCap, Users } from "lucide-react";

interface JoinFormProps {
  isTeacher: boolean;
  onJoin: (name: string, email?: string) => void;
  joining: boolean;
  error: string | null;
}

export function JoinForm({ isTeacher, onJoin, joining, error }: JoinFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (!isTeacher && !email.trim()) return;
    onJoin(name.trim(), isTeacher ? undefined : email.trim());
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25">
            {isTeacher ? (
              <GraduationCap className="h-8 w-8" />
            ) : (
              <Users className="h-8 w-8" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-white">
            {isTeacher ? "Join as Teacher" : "Join Class"}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {isTeacher
              ? "Enter your name to start the class"
              : "Enter your details to join the class"}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-sm"
        >
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-white placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              required
              autoFocus
            />
          </div>

          {!isTeacher && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-white placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                required
              />
              <p className="mt-1 text-xs text-zinc-500">
                Used to track your progress across sessions
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-800 bg-red-900/20 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={joining || !name.trim() || (!isTeacher && !email.trim())}
            className="w-full rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2.5 font-medium text-white shadow-lg shadow-violet-500/25 transition-all hover:from-violet-500 hover:to-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {joining ? "Joining..." : "Join Room"}
          </button>
        </form>
      </div>
    </div>
  );
}
