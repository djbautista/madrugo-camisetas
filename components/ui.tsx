import type { ReactNode } from "react";

// Pequeños componentes de presentación reutilizables (Tailwind).

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="font-medium text-slate-700">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      )}
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" aria-live="polite">
      {message}
    </p>
  );
}

export function SuccessMessage({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
      aria-live="polite"
    >
      {message}
    </p>
  );
}

const BADGE_STYLES: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
  slate: "bg-slate-100 text-slate-700",
  blue: "bg-blue-100 text-blue-800",
};

export function Badge({
  children,
  color = "slate",
}: {
  children: ReactNode;
  color?: keyof typeof BADGE_STYLES;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_STYLES[color]}`}
    >
      {children}
    </span>
  );
}

export function Th({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-sm text-slate-700 ${className}`}>{children}</td>;
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">{children}</table>
      </div>
    </Card>
  );
}
