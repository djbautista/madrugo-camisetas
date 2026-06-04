import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { getSession } from "@/lib/session";

export default async function LoginPage() {
  // Si ya hay sesión, ir directo al panel.
  const session = await getSession();
  if (session) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-slate-900">Madrugo</h1>
          <p className="mt-1 text-sm text-slate-500">
            Inventario y ventas de camisetas
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
