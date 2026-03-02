import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { SessionProvider } from "@/components/session-provider";
import { AcademyProvider } from "@/components/academy-provider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <SessionProvider session={session}>
      <AcademyProvider>
        <div className="flex h-screen bg-zinc-50/50 dark:bg-zinc-950">
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Header />
            <main className="bg-mesh-subtle flex-1 overflow-y-auto p-6">
              {children}
            </main>
          </div>
        </div>
      </AcademyProvider>
    </SessionProvider>
  );
}
