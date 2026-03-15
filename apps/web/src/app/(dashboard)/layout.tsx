"use client";

import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { AuthProvider, useAuth } from "@/components/auth-provider";
import { AcademyProvider } from "@/components/academy-provider";
import { TutorialProvider } from "@/components/tutorial-provider";
import { WizardProvider } from "@/components/exercise-wizard-context";
import { ExerciseWizard } from "@/components/exercise-wizard";
import { FloatingWizardBar } from "@/components/floating-wizard-bar";
import { UploadProvider } from "@/components/upload-progress-context";
import { UploadProgressWidget } from "@/components/upload-progress-widget";
import { SidebarProvider } from "@/components/sidebar-context";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50/50 dark:bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    router.replace("/login");
    return null;
  }

  return (
    <AcademyProvider>
      <SidebarProvider>
        <TutorialProvider>
          <WizardProvider>
            <UploadProvider>
              <div className="flex h-screen bg-zinc-50/50 dark:bg-zinc-950">
                <Sidebar />
                <div className="flex flex-1 flex-col overflow-hidden">
                  <Header />
                  <main className="bg-mesh-subtle flex-1 overflow-y-auto p-6">
                    {children}
                  </main>
                </div>
              </div>
              <ExerciseWizard />
              <FloatingWizardBar />
              <UploadProgressWidget />
            </UploadProvider>
          </WizardProvider>
        </TutorialProvider>
      </SidebarProvider>
    </AcademyProvider>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  );
}
