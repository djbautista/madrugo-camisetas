import {
  Badge,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { getDb } from "@/lib/db";
import { formatCOP, formatDateTime } from "@/lib/format";
import { requireRole } from "@/lib/session";
import {
  PAYMENT_METHOD_LABELS,
  SALE_TYPE_LABELS,
  type PaymentMethod,
  type SaleRow,
} from "@/lib/types";

export default async function SalesPage() {
  const session = await requireRole("admin", "seller");
  const isAdmin = session.role === "admin";

  // El vendedor solo ve sus propias ventas; el administrador, todas.
  const db = await getDb();
  const res = isAdmin
    ? await db.execute("SELECT * FROM sales ORDER BY created_at DESC")
    : await db.execute({
        sql: "SELECT * FROM sales WHERE seller_id = ? ORDER BY created_at DESC",
        args: [session.userId],
      });
  const sales = res.rows as unknown as SaleRow[];

  return (
    <div>
      <PageHeader
        title="Ventas"
        description={
          isAdmin
            ? "Todas las ventas registradas."
            : "Tus ventas registradas."
        }
      />

      {sales.length === 0 ? (
        <EmptyState
          title="Aún no hay ventas registradas"
          description="Las ventas aparecerán aquí una vez que se registren."
        />
      ) : (
        <Table>
          <thead className="bg-slate-50">
            <tr>
              <Th>Fecha y hora</Th>
              <Th>Producto</Th>
              <Th>Tipo</Th>
              <Th className="text-right">Cant.</Th>
              <Th className="text-right">Total</Th>
              <Th className="text-right">Recibido</Th>
              <Th>Pago</Th>
              <Th>Cliente</Th>
              {isAdmin && <Th>Vendedor</Th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sales.map((s) => {
              const mismatch = s.amount_received !== s.total_amount;
              return (
                <tr key={s.id} className="hover:bg-slate-50">
                  <Td className="whitespace-nowrap">
                    {formatDateTime(s.created_at)}
                  </Td>
                  <Td className="font-medium text-slate-900">
                    {s.reference} · {s.size}
                  </Td>
                  <Td>{SALE_TYPE_LABELS[s.sale_type]}</Td>
                  <Td className="text-right">
                    {s.quantity}
                    {s.sale_type === "dozen" ? " doc." : ""}
                  </Td>
                  <Td className="text-right font-semibold">
                    {formatCOP(s.total_amount)}
                  </Td>
                  <Td className="text-right">
                    <span className="inline-flex items-center gap-1">
                      {formatCOP(s.amount_received)}
                      {mismatch && <Badge color="amber">≠</Badge>}
                    </span>
                  </Td>
                  <Td>
                    {PAYMENT_METHOD_LABELS[s.payment_method as PaymentMethod] ??
                      s.payment_method}
                  </Td>
                  <Td>{s.customer_name}</Td>
                  {isAdmin && <Td>{s.seller_name}</Td>}
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
