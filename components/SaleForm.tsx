"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSale, type SaleState } from "@/app/actions/sales";
import { Card, FieldError, SuccessMessage } from "@/components/ui";
import { formatCOP } from "@/lib/format";
import {
  PAYMENT_METHODS,
  UNITS_PER_DOZEN,
  type SaleType,
} from "@/lib/types";

export interface SaleItem {
  id: number;
  reference: string;
  size: string;
  quantity: number;
  unit_price: number;
  dozen_price: number | null;
}

const initialState: SaleState = {};

export default function SaleForm({ items }: { items: SaleItem[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createSale, initialState);

  const [reference, setReference] = useState("");
  const [itemId, setItemId] = useState("");
  const [saleType, setSaleType] = useState<SaleType>("unit");
  const [quantity, setQuantity] = useState(1);
  const [amountReceived, setAmountReceived] = useState("");

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

  const canDozen = selected?.dozen_price != null;

  // Si el producto no tiene precio por docena, forzar venta por unidad.
  useEffect(() => {
    if (!canDozen && saleType === "dozen") setSaleType("unit");
  }, [canDozen, saleType]);

  // Refrescar datos del servidor tras una venta exitosa y limpiar el formulario.
  useEffect(() => {
    if (state.success) {
      router.refresh();
      setReference("");
      setItemId("");
      setSaleType("unit");
      setQuantity(1);
      setAmountReceived("");
    }
  }, [state.success, state.saleId, router]);

  const unitsNeeded =
    saleType === "dozen" ? quantity * UNITS_PER_DOZEN : quantity;
  const maxQty = selected
    ? saleType === "dozen"
      ? Math.floor(selected.quantity / UNITS_PER_DOZEN)
      : selected.quantity
    : 0;

  const pricePerShirt = selected
    ? saleType === "dozen"
      ? (selected.dozen_price as number) / UNITS_PER_DOZEN
      : selected.unit_price
    : 0;
  const expectedTotal = selected
    ? saleType === "dozen"
      ? quantity * (selected.dozen_price as number)
      : quantity * selected.unit_price
    : 0;

  const received = Number(amountReceived);
  const hasReceived = amountReceived !== "" && !Number.isNaN(received);
  const diff = hasReceived ? received - expectedTotal : 0;
  const insufficientStock = selected ? unitsNeeded > selected.quantity : false;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="p-5 lg:col-span-2">
        <form action={formAction} className="space-y-4">
          <FieldError message={state.error} />
          <SuccessMessage message={state.success} />

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
                }}
                required
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
              <label className="text-sm font-medium text-slate-700">Talla</label>
              <select
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                required
                disabled={!reference}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              >
                <option value="" disabled>
                  Selecciona…
                </option>
                {sizesForRef.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.size} (disponible: {i.quantity})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Hidden: id de inventario para el server action */}
          <input type="hidden" name="inventoryId" value={itemId} />

          {/* Tipo de venta y cantidad */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">
                Tipo de venta
              </label>
              <select
                name="saleType"
                value={saleType}
                onChange={(e) => setSaleType(e.target.value as SaleType)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="unit">Unidad</option>
                <option value="dozen" disabled={!canDozen}>
                  Docena {canDozen ? "" : "(sin precio por docena)"}
                </option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">
                Cantidad ({saleType === "dozen" ? "docenas" : "unidades"})
              </label>
              <input
                name="quantity"
                type="number"
                min={1}
                step={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              {selected && (
                <p className="text-xs text-slate-500">
                  Máximo: {maxQty} {saleType === "dozen" ? "docena(s)" : "unidad(es)"} ·
                  Descuenta {unitsNeeded} unidad(es) del stock
                </p>
              )}
            </div>
          </div>

          {insufficientStock && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              Stock insuficiente: se requieren {unitsNeeded} unidad(es) y solo hay{" "}
              {selected?.quantity}.
            </p>
          )}

          {/* Cliente y pago */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">
                Cliente
              </label>
              <input
                name="customerName"
                type="text"
                required
                placeholder="Nombre del comprador"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">
                Método de pago
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

          {/* Monto recibido */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">
                Monto recibido
              </label>
              <input
                name="amountReceived"
                type="number"
                min={0}
                step="any"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">
              Observaciones (opcional)
            </label>
            <textarea
              name="observations"
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={pending || !selected || insufficientStock}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {pending ? "Registrando…" : "Registrar venta"}
          </button>
        </form>
      </Card>

      {/* Resumen en vivo */}
      <Card className="h-fit p-5">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Resumen</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Precio por camiseta</dt>
            <dd className="font-medium">{formatCOP(pricePerShirt)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Unidades a descontar</dt>
            <dd className="font-medium">{selected ? unitsNeeded : "—"}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2">
            <dt className="font-semibold text-slate-700">Total esperado</dt>
            <dd className="text-lg font-bold text-slate-900">
              {formatCOP(expectedTotal)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Monto recibido</dt>
            <dd className="font-medium">
              {hasReceived ? formatCOP(received) : "—"}
            </dd>
          </div>
        </dl>

        {hasReceived && diff !== 0 && (
          <div
            className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              diff < 0
                ? "bg-red-50 text-red-700"
                : "bg-amber-50 text-amber-800"
            }`}
          >
            {diff < 0
              ? `Faltan ${formatCOP(Math.abs(diff))} respecto al total esperado.`
              : `El monto recibido supera el total esperado en ${formatCOP(diff)}.`}
          </div>
        )}
        {hasReceived && diff === 0 && expectedTotal > 0 && (
          <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            El monto recibido coincide con el total esperado.
          </div>
        )}
      </Card>
    </div>
  );
}
