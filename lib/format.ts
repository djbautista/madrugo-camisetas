// Utilidades de formato (pesos colombianos y fechas en español).

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatCOP(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return cop.format(value);
}

const dateTime = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return dateTime.format(d);
}

const dateOnly = new Intl.DateTimeFormat("es-CO", { dateStyle: "full" });

export function formatDate(isoOrDate: string): string {
  // Acepta 'YYYY-MM-DD' (de date(created_at) en SQLite) o ISO completo.
  const d = new Date(
    isoOrDate.length === 10 ? `${isoOrDate}T00:00:00` : isoOrDate,
  );
  if (Number.isNaN(d.getTime())) return isoOrDate;
  return dateOnly.format(d);
}
