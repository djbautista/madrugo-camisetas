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
  MOVEMENT_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  type MovementRow,
  type MovementType,
  type PaymentMethod,
} from "@/lib/types";

const TYPE_COLORS: Record<MovementType, "blue" | "green" | "amber" | "slate"> = {
  import: "blue",
  sale: "green",
  correction: "amber",
  adjustment: "amber",
};

export default async function MovementsPage() {
  // Solo el administrador puede ver el historial de movimientos.
  await requireRole("admin");

  const db = await getDb();
  const res = await db.execute(
    "SELECT * FROM movements ORDER BY created_at DESC, id DESC",
  );
  const movements = res.rows as unknown as MovementRow[];

  return (
    <div>
      <PageHeader
        title="Historial de movimientos"
        description="Trazabilidad de todas las entradas y salidas de inventario. Solo lectura."
      />

      {movements.length === 0 ? (
        <EmptyState title="Aún no hay movimientos registrados" />
      ) : (
        <Table>
          <thead className="bg-slate-50">
            <tr>
              <Th>Fecha y hora</Th>
              <Th>Tipo</Th>
              <Th>Responsable</Th>
              <Th>Producto</Th>
              <Th className="text-right">Cantidad</Th>
              <Th className="text-right">Dinero</Th>
              <Th>Pago</Th>
              <Th>Observaciones</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {movements.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50">
                <Td className="whitespace-nowrap">
                  {formatDateTime(m.created_at)}
                </Td>
                <Td>
                  <Badge color={TYPE_COLORS[m.type]}>
                    {MOVEMENT_TYPE_LABELS[m.type]}
                  </Badge>
                </Td>
                <Td>{m.user_name}</Td>
                <Td className="font-medium text-slate-900">
                  {m.reference} · {m.size}
                </Td>
                <Td
                  className={`text-right font-semibold ${
                    m.quantity_moved < 0 ? "text-red-600" : "text-emerald-600"
                  }`}
                >
                  {m.quantity_moved > 0 ? "+" : ""}
                  {m.quantity_moved}
                </Td>
                <Td className="text-right">
                  {m.money_received != null ? formatCOP(m.money_received) : "—"}
                </Td>
                <Td>
                  {m.payment_method
                    ? (PAYMENT_METHOD_LABELS[
                        m.payment_method as PaymentMethod
                      ] ?? m.payment_method)
                    : "—"}
                </Td>
                <Td>{m.observations ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
