"use client";

import { useState } from "react";
import { Badge, Table, Td, Th } from "@/components/ui";
import { formatCOP, formatDateTime } from "@/lib/format";
import {
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
  type ReturnWithItems,
} from "@/lib/types";

// Resumen del producto para la fila contraída.
function productSummary(ret: ReturnWithItems): string {
  if (ret.items.length === 0) return "—";
  const [first] = ret.items;
  const label = `${first.reference} · ${first.size}`;
  const rest = ret.items.length - 1;
  return rest > 0 ? `${label} (+${rest} más)` : label;
}

const COL_SPAN = 7; // columna de expansión + 6 columnas de datos

export default function ReturnsTable({
  returns,
}: {
  returns: ReturnWithItems[];
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Table>
      <thead className="bg-slate-50">
        <tr>
          <Th>{""}</Th>
          <Th>Fecha y hora</Th>
          <Th>Productos</Th>
          <Th className="text-right">Total devuelto</Th>
          <Th>Reembolso</Th>
          <Th>Cliente</Th>
          <Th>Registrada por</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {returns.map((r) => (
          <ReturnRows
            key={r.id}
            ret={r}
            isOpen={expanded.has(r.id)}
            onToggle={() => toggle(r.id)}
          />
        ))}
      </tbody>
    </Table>
  );
}

function ReturnRows({
  ret,
  isOpen,
  onToggle,
}: {
  ret: ReturnWithItems;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="cursor-pointer hover:bg-slate-50"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <Td className="text-slate-400">{isOpen ? "▾" : "▸"}</Td>
        <Td className="whitespace-nowrap">{formatDateTime(ret.created_at)}</Td>
        <Td className="font-medium text-slate-900">{productSummary(ret)}</Td>
        <Td className="text-right font-semibold">
          {formatCOP(ret.total_refund)}
        </Td>
        <Td>
          {PAYMENT_METHOD_LABELS[ret.payment_method as PaymentMethod] ??
            ret.payment_method}
        </Td>
        <Td>{ret.customer_name ?? "—"}</Td>
        <Td>{ret.user_name}</Td>
      </tr>

      {isOpen && (
        <tr className="bg-slate-50/60">
          <Td className="!p-0"> </Td>
          <td className="px-4 py-3" colSpan={COL_SPAN - 1}>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Producto</th>
                    <th className="px-3 py-2 text-right">Cant.</th>
                    <th className="px-3 py-2">Reingreso</th>
                    <th className="px-3 py-2 text-right">Monto devuelto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ret.items.map((it) => (
                    <tr key={it.id}>
                      <td className="px-3 py-2 font-medium text-slate-900">
                        {it.reference} · {it.size}
                      </td>
                      <td className="px-3 py-2 text-right">{it.quantity}</td>
                      <td className="px-3 py-2">
                        <Badge color={it.restocked ? "green" : "slate"}>
                          {it.restocked ? "Reingresado" : "Sin reingreso"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {formatCOP(it.refund_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {ret.observations && (
              <p className="mt-2 text-xs text-slate-500">
                Observaciones: {ret.observations}
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
