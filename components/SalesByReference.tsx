"use client";

import { useState } from "react";
import { Card } from "@/components/ui";

export interface SizeStat {
  size: string;
  sold: number;
  remaining: number;
}

export interface ReferenceStat {
  reference: string;
  sold: number;
  remaining: number;
  sizes: SizeStat[];
}

// Tarjeta de resumen: unidades vendidas y restantes (almacén + consignación)
// agrupadas por referencia, con las tallas desplegables.
export default function SalesByReference({ stats }: { stats: ReferenceStat[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(reference: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(reference)) next.delete(reference);
      else next.add(reference);
      return next;
    });
  }

  return (
    <Card className="mb-6 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Ventas por referencia
      </p>
      <div className="mt-2 divide-y divide-slate-100">
        {stats.map((ref) => {
          const isOpen = expanded.has(ref.reference);
          return (
            <div key={ref.reference}>
              <button
                type="button"
                onClick={() => toggle(ref.reference)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-3 py-2 text-left hover:bg-slate-50"
              >
                <span className="flex items-center gap-2 font-medium text-slate-900">
                  <span className="text-slate-400">{isOpen ? "▾" : "▸"}</span>
                  {ref.reference}
                </span>
                <span className="flex shrink-0 items-center gap-4 text-sm">
                  <span className="text-slate-500">
                    Vendidas{" "}
                    <span className="font-semibold text-slate-900">
                      {ref.sold}
                    </span>
                  </span>
                  <span className="text-slate-500">
                    Restantes{" "}
                    <span className="font-semibold text-slate-900">
                      {ref.remaining}
                    </span>
                  </span>
                </span>
              </button>

              {isOpen && (
                <div className="overflow-x-auto pb-3 pl-6">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-xs uppercase text-slate-500">
                      <tr>
                        <th className="py-1 pr-4 font-semibold">Talla</th>
                        <th className="py-1 pr-4 text-right font-semibold">
                          Vendidas
                        </th>
                        <th className="py-1 text-right font-semibold">
                          Restantes
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ref.sizes.map((s) => (
                        <tr key={s.size}>
                          <td className="py-1 pr-4 text-slate-700">{s.size}</td>
                          <td className="py-1 pr-4 text-right text-slate-700">
                            {s.sold}
                          </td>
                          <td className="py-1 text-right text-slate-700">
                            {s.remaining}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
