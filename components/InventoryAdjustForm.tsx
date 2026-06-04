"use client";

import { useActionState } from "react";
import { adjustInventory, type AdjustState } from "@/app/actions/inventory";
import { Card, FieldError, SuccessMessage } from "@/components/ui";

interface Option {
  id: number;
  reference: string;
  size: string;
  quantity: number;
}

const initialState: AdjustState = {};

export default function InventoryAdjustForm({
  products,
}: {
  products: Option[];
}) {
  const [state, formAction, pending] = useActionState(
    adjustInventory,
    initialState,
  );

  return (
    <Card className="mb-6 p-5">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">
        Corregir / ajustar stock
      </h2>
      <p className="mb-4 text-sm text-slate-500">
        Solo administradores. Cada ajuste queda registrado en el historial de
        movimientos.
      </p>

      <form action={formAction} className="space-y-4">
        <FieldError message={state.error} />
        <SuccessMessage message={state.success} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="inventoryId" className="text-sm font-medium text-slate-700">
              Producto
            </label>
            <select
              id="inventoryId"
              name="inventoryId"
              required
              defaultValue=""
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Selecciona…
              </option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.reference} · Talla {p.size} (stock: {p.quantity})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="adjustMode" className="text-sm font-medium text-slate-700">
              Tipo de ajuste
            </label>
            <select
              id="adjustMode"
              name="adjustMode"
              defaultValue="set"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="set">Fijar stock exacto</option>
              <option value="delta">Sumar / restar (usa negativos)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="value" className="text-sm font-medium text-slate-700">
              Valor
            </label>
            <input
              id="value"
              name="value"
              type="number"
              step="1"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="reason" className="text-sm font-medium text-slate-700">
              Motivo
            </label>
            <input
              id="reason"
              name="reason"
              type="text"
              required
              placeholder="Ej: conteo físico, producto dañado…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
        >
          {pending ? "Aplicando…" : "Aplicar ajuste"}
        </button>
      </form>
    </Card>
  );
}
