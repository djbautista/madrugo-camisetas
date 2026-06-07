import ReturnForm from "@/components/ReturnForm";
import ReturnsTable from "@/components/ReturnsTable";
import { EmptyState, PageHeader } from "@/components/ui";
import { getDb } from "@/lib/db";
import { getInventory } from "@/lib/reports";
import { requireRole } from "@/lib/session";
import type {
  ReturnHeaderRow,
  ReturnItemRow,
  ReturnWithItems,
} from "@/lib/types";

export default async function ReturnsPage() {
  // Solo el Administrador puede registrar y ver devoluciones.
  await requireRole("admin");

  // Sin filtrar por stock: se puede devolver una referencia agotada.
  const items = await getInventory();

  // Historial de devoluciones con sus líneas, agrupadas por devolución.
  const db = await getDb();
  const headersRes = await db.execute(
    "SELECT * FROM returns ORDER BY created_at DESC",
  );
  const headers = headersRes.rows as unknown as ReturnHeaderRow[];

  const returns: ReturnWithItems[] = headers.map((h) => ({ ...h, items: [] }));
  if (headers.length > 0) {
    const ids = headers.map((h) => h.id);
    const placeholders = ids.map(() => "?").join(",");
    const itemsRes = await db.execute({
      sql: `SELECT * FROM return_items WHERE return_id IN (${placeholders}) ORDER BY id`,
      args: ids,
    });
    const byId = new Map(returns.map((r) => [r.id, r]));
    for (const row of itemsRes.rows as unknown as ReturnItemRow[]) {
      byId.get(row.return_id)?.items.push(row);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <PageHeader
          title="Devoluciones"
          description="Registra devoluciones y reembolsos. Solo administradores."
        />

        {items.length === 0 ? (
          <EmptyState
            title="No hay productos en el inventario"
            description="No es posible registrar devoluciones hasta que haya productos registrados."
          />
        ) : (
          <ReturnForm
            items={items.map((i) => ({
              id: i.id,
              reference: i.reference,
              size: i.size,
              quantity: i.quantity,
              unit_price: i.unit_price,
            }))}
          />
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">
          Historial de devoluciones
        </h2>
        {returns.length === 0 ? (
          <EmptyState
            title="Aún no hay devoluciones registradas"
            description="Las devoluciones aparecerán aquí una vez que se registren."
          />
        ) : (
          <ReturnsTable returns={returns} />
        )}
      </div>
    </div>
  );
}
