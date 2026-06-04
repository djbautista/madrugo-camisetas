import type { ReactNode } from "react";
import Nav from "@/components/Nav";
import { requireSession } from "@/lib/session";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="flex min-h-screen flex-col">
      <Nav role={session.role} name={session.name} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
