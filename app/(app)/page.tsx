import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { getDashboardStats } from "@/lib/reports";
import { formatCOP } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { ROLE_LABELS, type Role } from "@/lib/types";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </Card>
  );
}

const QUICK_LINKS: { href: string; title: string; desc: string; roles: Role[] }[] = [
  {
    href: "/ventas/nueva",
    title: "Registrar venta",
    desc: "Vender camisetas por unidad o docena",
    roles: ["admin", "seller"],
  },
  {
    href: "/inventario",
    title: "Ver inventario",
    desc: "Stock disponible en tiempo real",
    roles: ["admin", "seller", "viewer"],
  },
  {
    href: "/inventario/importar",
    title: "Importar inventario",
    desc: "Cargar stock desde un archivo XLSX",
    roles: ["admin"],
  },
  {
    href: "/reportes",
    title: "Ver reportes",
    desc: "Ventas, stock bajo y más",
    roles: ["admin", "viewer"],
  },
  {
    href: "/movimientos",
    title: "Historial de movimientos",
    desc: "Trazabilidad de todo el inventario",
    roles: ["admin"],
  },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireSession();
  const { error } = await searchParams;
  const stats = await getDashboardStats();
  const links = QUICK_LINKS.filter((l) => l.roles.includes(session.role));

  return (
    <div>
      <PageHeader
        title={`Hola, ${session.name}`}
        description={`Has ingresado como ${ROLE_LABELS[session.role]}.`}
      />

      {error === "permiso" && (
        <div className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No tienes permisos para acceder a esa sección.
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Unidades en stock" value={String(stats.total_units)} />
        <Stat label="Productos (ref. + talla)" value={String(stats.distinct_products)} />
        <Stat label="Ventas de hoy" value={`${stats.sales_today_count}`} />
        <Stat label="Ingresos de hoy" value={formatCOP(stats.sales_today_revenue)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="h-full p-5 transition hover:border-blue-300 hover:shadow-md">
              <p className="font-semibold text-slate-900">{link.title}</p>
              <p className="mt-1 text-sm text-slate-500">{link.desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
