import ExpenseForm from "@/components/ExpenseForm";
import ExpensesTable from "@/components/ExpensesTable";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { getDb } from "@/lib/db";
import { formatCOP } from "@/lib/format";
import { requireRole } from "@/lib/session";
import type { ExpenseRow } from "@/lib/types";

export default async function ExpensesPage() {
  // Solo el Administrador puede registrar y ver gastos.
  await requireRole("admin");

  const db = await getDb();
  const res = await db.execute(
    "SELECT * FROM expenses ORDER BY created_at DESC",
  );
  const expenses = res.rows as unknown as ExpenseRow[];

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Gastos"
        description="Costos operativos del negocio. Solo administradores."
        action={<ExpenseForm />}
      />

      <Card className="p-5">
        <dl className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <dt className="text-sm text-slate-500">Total de gastos</dt>
            <dd className="text-2xl font-bold text-slate-900">
              {formatCOP(total)}
            </dd>
          </div>
          <div className="text-right">
            <dt className="text-sm text-slate-500">Registros</dt>
            <dd className="text-lg font-semibold text-slate-700">
              {expenses.length}
            </dd>
          </div>
        </dl>
      </Card>

      {expenses.length === 0 ? (
        <EmptyState
          title="Aún no hay gastos registrados"
          description="Usa el botón “Registrar gasto” para añadir el primer costo operativo."
        />
      ) : (
        <ExpensesTable expenses={expenses} />
      )}
    </div>
  );
}
