import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SessionProvider } from "@/components/session-provider";

export default async function SessionLayout({
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
      <div className="h-screen w-screen overflow-hidden">{children}</div>
    </SessionProvider>
  );
}
