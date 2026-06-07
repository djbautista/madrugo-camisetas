import { EmptyState, PageHeader } from "@/components/ui";
import SalesTable from "@/components/SalesTable";
import { getDb } from "@/lib/db";
import { requireRole } from "@/lib/session";
import type { SaleHeaderRow, SaleItemRow, SaleWithItems } from "@/lib/types";

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

  return (
    <div>
      <PageHeader
        title="Ventas"
        description={
          isAdmin ? "Todas las ventas registradas." : "Tus ventas registradas."
        }
      />

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
