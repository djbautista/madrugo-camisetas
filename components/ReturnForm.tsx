"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createReturn, type ReturnState } from "@/app/actions/returns";
import { Badge, Card, FieldError, SuccessMessage } from "@/components/ui";
import { formatCOP } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/types";

export interface ReturnFormItem {
  id: number;
  reference: string;
  size: string;
  quantity: number;
  unit_price: number;
}

// Línea agregada a la devolución.
interface CartLine {
  inventoryId: number;
  reference: string;
  size: string;
  quantity: number;
  restock: boolean;
  refundAmount: number;
}

const initialState: ReturnState = {};

export default function ReturnForm({ items }: { items: ReturnFormItem[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    createReturn,
    initialState,
  );

  // --- Sub-formulario "agregar línea" ---
  const [reference, setReference] = useState("");
  const [itemId, setItemId] = useState("");
  // Texto crudo del input para permitir borrarlo mientras se escribe;
  // vacío o inválido => cantidad 0, que bloquea "Agregar a la devolución".
  const [quantityInput, setQuantityInput] = useState("1");
  const quantity = Math.floor(Number(quantityInput)) || 0;
  const [restock, setRestock] = useState(true);
  // Monto a devolver: por defecto se deriva del precio unitario × cantidad;
  // si el administrador lo edita, su valor (override) tiene prioridad hasta
  // que cambie el producto o la cantidad.
  const [refundOverride, setRefundOverride] = useState<string | null>(null);

  // --- Carrito y campos a nivel de devolución ---
  const [cart, setCart] = useState<CartLine[]>([]);

  const references = useMemo(
    () => Array.from(new Set(items.map((i) => i.reference))),
    [items],
  );
  const sizesForRef = useMemo(
    () => items.filter((i) => i.reference === reference),
    [items, reference],
  );
  const selected = useMemo(
    () => items.find((i) => String(i.id) === itemId),
    [items, itemId],
  );

  const suggestedRefund =
    selected && quantity > 0 ? selected.unit_price * quantity : null;
  const refundInput =
    refundOverride ?? (suggestedRefund != null ? String(suggestedRefund) : "");

  // Limpiar el formulario tras una devolución exitosa (ajuste de estado
  // durante el render, con guarda por returnId para hacerlo una sola vez).
  const [handledReturnId, setHandledReturnId] = useState<number | undefined>(
    undefined,
  );
  if (state.returnId !== undefined && state.returnId !== handledReturnId) {
    setHandledReturnId(state.returnId);
    setReference("");
    setItemId("");
    setQuantityInput("1");
    setRestock(true);
    setRefundOverride(null);
    setCart([]);
  }

  // Refrescar datos del servidor tras una devolución exitosa.
  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, state.returnId, router]);

  const refundAmount = Number(refundInput);
  const refundValid =
    refundInput !== "" && Number.isFinite(refundAmount) && refundAmount >= 0;
  const canAdd = !!selected && quantity > 0 && refundValid;

  const totalRefund = cart.reduce((sum, l) => sum + l.refundAmount, 0);
  const restockUnits = cart.reduce(
    (sum, l) => sum + (l.restock ? l.quantity : 0),
    0,
  );

  function addLine() {
    if (!selected || !canAdd) return;
    setCart((c) => [
      ...c,
      {
        inventoryId: selected.id,
        reference: selected.reference,
        size: selected.size,
        quantity,
        restock,
        refundAmount,
      },
    ]);
    // Reiniciar el sub-formulario para agregar otra línea.
    setReference("");
    setItemId("");
    setQuantityInput("1");
    setRestock(true);
    setRefundOverride(null);
  }

  function removeLine(index: number) {
    setCart((c) => c.filter((_, i) => i !== index));
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* Agregar producto a la devolución */}
        <Card className="p-5">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">
            Agregar producto devuelto
          </h2>
          <div className="space-y-4">
            {/* Producto y talla */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">
                  Referencia / modelo
                </label>
                <select
                  value={reference}
                  onChange={(e) => {
                    setReference(e.target.value);
                    setItemId("");
                    setRefundOverride(null);
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="" disabled>
                    Selecciona…
                  </option>
                  {references.map((ref) => (
                    <option key={ref} value={ref}>
                      {ref}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">
                  Talla
                </label>
                <select
                  value={itemId}
                  onChange={(e) => {
                    setItemId(e.target.value);
                    setRefundOverride(null);
                  }}
                  disabled={!reference}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                >
                  <option value="" disabled>
                    Selecciona…
                  </option>
                  {sizesForRef.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.size} (stock actual: {i.quantity})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Cantidad y monto a devolver */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">
                  Cantidad (unidades)
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={quantityInput}
                  onChange={(e) => {
                    setQuantityInput(e.target.value);
                    setRefundOverride(null);
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">
                  Monto a devolver
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={refundInput}
                  onChange={(e) => setRefundOverride(e.target.value)}
                  disabled={!selected}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                />
                {selected && quantity > 0 && (
                  <p className="text-xs text-slate-500">
                    Sugerido: {formatCOP(selected.unit_price * quantity)} (
                    {quantity} × {formatCOP(selected.unit_price)}). Puedes
                    ajustarlo.
                  </p>
                )}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={restock}
                onChange={(e) => setRestock(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Reingresar al inventario
            </label>
            {!restock && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                La línea quedará registrada sin sumar stock (p. ej. camiseta
                defectuosa).
              </p>
            )}

            <button
              type="button"
              onClick={addLine}
              disabled={!canAdd}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              Agregar a la devolución
            </button>
          </div>
        </Card>

        {/* Carrito + datos de la devolución */}
        <Card className="p-5">
          <form action={formAction} className="space-y-4">
            <FieldError message={state.error} />
            <SuccessMessage message={state.success} />

            <h2 className="text-lg font-semibold text-slate-900">
              Productos de la devolución
            </h2>

            {cart.length === 0 ? (
              <p className="rounded-md bg-slate-50 px-3 py-3 text-sm text-slate-500">
                Aún no has agregado productos. Usa el formulario de arriba.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-1">Producto</th>
                      <th className="py-1 text-right">Cant.</th>
                      <th className="py-1 text-center">Reingresa</th>
                      <th className="py-1 text-right">Monto a devolver</th>
                      <th className="py-1"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cart.map((l, idx) => (
                      <tr key={idx}>
                        <td className="py-2 font-medium text-slate-900">
                          {l.reference} · {l.size}
                        </td>
                        <td className="py-2 text-right">{l.quantity}</td>
                        <td className="py-2 text-center">
                          <Badge color={l.restock ? "green" : "slate"}>
                            {l.restock ? "Sí" : "No"}
                          </Badge>
                        </td>
                        <td className="py-2 text-right font-semibold">
                          {formatCOP(l.refundAmount)}
                        </td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            className="text-sm font-medium text-red-600 hover:text-red-800"
                          >
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Cliente y método de reembolso */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">
                  Cliente (opcional)
                </label>
                <input
                  name="customerName"
                  type="text"
                  placeholder="Nombre de quien devuelve"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">
                  Método de reembolso
                </label>
                <select
                  name="paymentMethod"
                  required
                  defaultValue=""
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="" disabled>
                    Selecciona…
                  </option>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">
                Observaciones / motivo (opcional)
              </label>
              <textarea
                name="observations"
                rows={2}
                placeholder="Motivo de la devolución, estado de las prendas…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            {/* Líneas de la devolución serializadas para el server action */}
            <input
              type="hidden"
              name="items"
              value={JSON.stringify(
                cart.map((l) => ({
                  inventoryId: l.inventoryId,
                  quantity: l.quantity,
                  restock: l.restock,
                  refundAmount: l.refundAmount,
                })),
              )}
            />

            <button
              type="submit"
              disabled={pending || cart.length === 0}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {pending ? "Registrando…" : "Registrar devolución"}
            </button>
          </form>
        </Card>
      </div>

      {/* Resumen en vivo */}
      <Card className="h-fit p-5">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Resumen</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Productos</dt>
            <dd className="font-medium">{cart.length}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Unidades a reingresar</dt>
            <dd className="font-medium">{restockUnits}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2">
            <dt className="font-semibold text-slate-700">Total a devolver</dt>
            <dd className="text-lg font-bold text-slate-900">
              {formatCOP(totalRefund)}
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
