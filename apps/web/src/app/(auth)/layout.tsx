import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Globe } from "lucide-react";
import Link from "next/link";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Redirect logged-in users to dashboard
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="bg-mesh relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* Background orbs */}
      <div className="pointer-events-none fixed inset-0">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <Link
          href="/"
          className="mb-8 flex items-center justify-center gap-2.5"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-accent shadow-lg">
            <Globe className="h-5 w-5 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight">Langopia</span>
        </Link>

        {children}
      </div>
    </div>
  );
}
