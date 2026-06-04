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

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-100 p-4 text-xs text-slate-600">
          <p className="mb-2 font-semibold text-slate-700">
            Usuarios de prueba
          </p>
          <ul className="space-y-1">
            <li>
              <span className="font-medium">Administrador:</span> admin / admin123
            </li>
            <li>
              <span className="font-medium">Vendedor:</span> vendedor / venta123
            </li>
            <li>
              <span className="font-medium">Consulta:</span> consulta / ver123
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
