import { Card, EmptyState, PageHeader } from "@/components/ui";
import SalesTable from "@/components/SalesTable";
import SalesByReference, {
  type ReferenceStat,
} from "@/components/SalesByReference";
import { getDb } from "@/lib/db";
import { formatCOP } from "@/lib/format";
import { getInventoryWithConsignment } from "@/lib/reports";
import { requireRole } from "@/lib/session";
import type { SaleHeaderRow, SaleItemRow, SaleWithItems } from "@/lib/types";

// Orden de tallas habitual de ropa; las desconocidas se ordenan al final.
const SIZE_ORDER = ["xs", "s", "m", "l", "xl", "xxl", "xxxl"];

function sizeSortKey(size: string): [number, number, string] {
  const letter = SIZE_ORDER.indexOf(size.trim().toLowerCase());
  if (letter >= 0) return [0, letter, ""];
  const num = Number.parseFloat(size);
  if (!Number.isNaN(num)) return [1, num, ""];
  return [2, 0, size.toLowerCase()];
}

function compareSizes(a: string, b: string): number {
  const ka = sizeSortKey(a);
  const kb = sizeSortKey(b);
  return ka[0] - kb[0] || ka[1] - kb[1] || ka[2].localeCompare(kb[2]);
}

// Resumen de unidades vendidas y restantes por referencia/talla. Las vendidas
// salen de las ventas visibles; las restantes, del stock real (almacén +
// consignación). Solo se incluyen las referencias con ventas.
async function buildReferenceStats(
  sales: SaleWithItems[],
): Promise<ReferenceStat[]> {
  const cells = new Map<string, Map<string, { sold: number; remaining: number }>>();
  const cell = (reference: string, size: string) => {
    let sizes = cells.get(reference);
    if (!sizes) cells.set(reference, (sizes = new Map()));
    let c = sizes.get(size);
    if (!c) sizes.set(size, (c = { sold: 0, remaining: 0 }));
    return c;
  };

  for (const sale of sales) {
    for (const it of sale.items) cell(it.reference, it.size).sold += it.units_deducted;
  }
  const inventory = await getInventoryWithConsignment();
  for (const inv of inventory) {
    cell(inv.reference, inv.size).remaining += inv.quantity + inv.consigned;
  }

  return [...cells.entries()]
    .map(([reference, sizes]) => {
      const sizeStats = [...sizes.entries()]
        .map(([size, v]) => ({ size, ...v }))
        .sort((a, b) => compareSizes(a.size, b.size));
      return {
        reference,
        sold: sizeStats.reduce((acc, s) => acc + s.sold, 0),
        remaining: sizeStats.reduce((acc, s) => acc + s.remaining, 0),
        sizes: sizeStats,
      };
    })
    // Solo referencias con ventas; las más vendidas primero.
    .filter((r) => r.sold > 0)
    .sort((a, b) => b.sold - a.sold || a.reference.localeCompare(b.reference));
}

export default async function SalesPage() {
  const session = await requireRole("admin", "seller");
  const isAdmin = session.role === "admin";

  // El vendedor solo ve sus propias ventas; el administrador, todas.
  const db = await getDb();
  const headersRes = isAdmin
    ? await db.execute("SELECT * FROM sales ORDER BY created_at DESC")
    : await db.execute({
        sql: "SELECT * FROM sales WHERE seller_id = ? ORDER BY created_at DESC",
        args: [session.userId],
      });
  const headers = headersRes.rows as unknown as SaleHeaderRow[];

  // Líneas de las ventas visibles, agrupadas por venta.
  const sales: SaleWithItems[] = headers.map((h) => ({ ...h, items: [] }));
  if (headers.length > 0) {
    const ids = headers.map((h) => h.id);
    const placeholders = ids.map(() => "?").join(",");
    const itemsRes = await db.execute({
      sql: `SELECT * FROM sale_items WHERE sale_id IN (${placeholders}) ORDER BY id`,
      args: ids,
    });
    const byId = new Map(sales.map((s) => [s.id, s]));
    for (const row of itemsRes.rows as unknown as SaleItemRow[]) {
      byId.get(row.sale_id)?.items.push(row);
    }
  }

  const totalReceived = sales.reduce((acc, s) => acc + s.amount_received, 0);
  const referenceStats =
    sales.length > 0 ? await buildReferenceStats(sales) : [];

  return (
    <div>
      <PageHeader
        title="Ventas"
        description={
          isAdmin ? "Todas las ventas registradas." : "Tus ventas registradas."
        }
      />

      {sales.length > 0 && (
        <Card className="mb-6 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Recibido total
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {formatCOP(totalReceived)}
          </p>
        </Card>
      )}

      {referenceStats.length > 0 && (
        <SalesByReference stats={referenceStats} />
      )}

      {sales.length === 0 ? (
        <EmptyState
          title="Aún no hay ventas registradas"
          description="Las ventas aparecerán aquí una vez que se registren."
        />
      ) : (
        <SalesTable sales={sales} isAdmin={isAdmin} />
      )}
    </div>
  );
}
