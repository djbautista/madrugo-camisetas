"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { ROLE_LABELS, type Role } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  roles: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", roles: ["admin", "seller", "viewer"] },
  { href: "/inventario", label: "Inventario", roles: ["admin", "seller", "viewer"] },
  { href: "/inventario/importar", label: "Importar", roles: ["admin"] },
  { href: "/ventas/nueva", label: "Nueva venta", roles: ["admin", "seller"] },
  { href: "/ventas", label: "Ventas", roles: ["admin", "seller"] },
  { href: "/movimientos", label: "Movimientos", roles: ["admin"] },
  { href: "/reportes", label: "Reportes", roles: ["admin", "viewer"] },
];

export default function Nav({ role, name }: { role: Role; name: string }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-slate-900">
          Madrugo
        </Link>

        <nav className="flex flex-1 flex-wrap items-center gap-1">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                isActive(item.href)
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-slate-700">{name}</p>
            <p className="text-xs text-slate-400">{ROLE_LABELS[role]}</p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Salir
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
