"use client";

import { useState } from "react";
import { Badge, Table, Td, Th } from "@/components/ui";
import { formatCOP, formatDateTime } from "@/lib/format";
import {
  PAYMENT_METHOD_LABELS,
  SALE_TYPE_LABELS,
  type PaymentMethod,
  type SaleWithItems,
} from "@/lib/types";

// Resumen del producto para la fila contraída.
function productSummary(sale: SaleWithItems): string {
  if (sale.items.length === 0) return "—";
  const [first] = sale.items;
  const label = `${first.reference} · ${first.size}`;
  const rest = sale.items.length - 1;
  return rest > 0 ? `${label} (+${rest} más)` : label;
}

export default function SalesTable({
  sales,
  isAdmin,
}: {
  sales: SaleWithItems[];
  isAdmin: boolean;
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

  // +1 por la columna de expansión; +1 si se muestra el vendedor.
  const colSpan = 7 + (isAdmin ? 1 : 0);

  return (
    <Table>
      <thead className="bg-slate-50">
        <tr>
          <Th>{""}</Th>
          <Th>Fecha y hora</Th>
          <Th>Productos</Th>
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
          const isOpen = expanded.has(s.id);
          return (
            <SaleRows
              key={s.id}
              sale={s}
              isAdmin={isAdmin}
              isOpen={isOpen}
              mismatch={mismatch}
              colSpan={colSpan}
              onToggle={() => toggle(s.id)}
            />
          );
        })}
      </tbody>
    </Table>
  );
}

function SaleRows({
  sale,
  isAdmin,
  isOpen,
  mismatch,
  colSpan,
  onToggle,
}: {
  sale: SaleWithItems;
  isAdmin: boolean;
  isOpen: boolean;
  mismatch: boolean;
  colSpan: number;
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
        <Td className="whitespace-nowrap">{formatDateTime(sale.created_at)}</Td>
        <Td className="font-medium text-slate-900">{productSummary(sale)}</Td>
        <Td className="text-right font-semibold">
          {formatCOP(sale.total_amount)}
        </Td>
        <Td className="text-right">
          <span className="inline-flex items-center gap-1">
            {formatCOP(sale.amount_received)}
            {mismatch && <Badge color="amber">≠</Badge>}
          </span>
        </Td>
        <Td>
          {PAYMENT_METHOD_LABELS[sale.payment_method as PaymentMethod] ??
            sale.payment_method}
        </Td>
        <Td>{sale.customer_name}</Td>
        {isAdmin && <Td>{sale.seller_name}</Td>}
      </tr>

      {isOpen && (
        <tr className="bg-slate-50/60">
          <Td className="!p-0"> </Td>
          <td className="px-4 py-3" colSpan={colSpan - 1}>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Producto</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2 text-right">Cant.</th>
                    <th className="px-3 py-2 text-right">Precio/camiseta</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sale.items.map((it) => (
                    <tr key={it.id}>
                      <td className="px-3 py-2 font-medium text-slate-900">
                        {it.reference} · {it.size}
                      </td>
                      <td className="px-3 py-2">
                        {SALE_TYPE_LABELS[it.sale_type]}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {it.quantity}
                        {it.sale_type === "dozen" ? " doc." : ""}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatCOP(it.price_per_shirt)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {formatCOP(it.total_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sale.observations && (
              <p className="mt-2 text-xs text-slate-500">
                Observaciones: {sale.observations}
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
