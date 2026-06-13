import { Table, Td, Th } from "@/components/ui";
import { formatCOP, formatDateTime } from "@/lib/format";
import type { ExpenseRow } from "@/lib/types";

export default function ExpensesTable({ expenses }: { expenses: ExpenseRow[] }) {
  return (
    <Table>
      <thead className="bg-slate-50">
        <tr>
          <Th>Fecha y hora</Th>
          <Th>Concepto</Th>
          <Th className="text-right">Valor</Th>
          <Th>Registrado por</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {expenses.map((e) => (
          <tr key={e.id} className="hover:bg-slate-50">
            <Td className="whitespace-nowrap">{formatDateTime(e.created_at)}</Td>
            <Td className="font-medium text-slate-900">{e.concept}</Td>
            <Td className="text-right font-semibold">{formatCOP(e.amount)}</Td>
            <Td>{e.user_name}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
