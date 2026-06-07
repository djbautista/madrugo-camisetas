"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSale, type SaleState } from "@/app/actions/sales";
import { Card, FieldError, SuccessMessage } from "@/components/ui";
import { formatCOP } from "@/lib/format";
import {
  PAYMENT_METHODS,
  SALE_TYPE_LABELS,
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

// Línea agregada al carrito de la venta.
interface CartLine {
  inventoryId: number;
  reference: string;
  size: string;
  saleType: SaleType;
  quantity: number;
}

const initialState: SaleState = {};

// Precio por camiseta de una línea, según tipo de venta.
function linePrice(item: SaleItem, saleType: SaleType): number {
  return saleType === "dozen"
    ? (item.dozen_price as number) / UNITS_PER_DOZEN
    : item.unit_price;
}

// Total de una línea (cantidad de unidades o docenas × precio).
function lineTotal(item: SaleItem, saleType: SaleType, quantity: number): number {
  return saleType === "dozen"
    ? quantity * (item.dozen_price as number)
    : quantity * item.unit_price;
}

// Unidades de stock que descuenta una línea.
function lineUnits(saleType: SaleType, quantity: number): number {
  return saleType === "dozen" ? quantity * UNITS_PER_DOZEN : quantity;
}

export default function SaleForm({ items }: { items: SaleItem[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createSale, initialState);

  // --- Sub-formulario "agregar línea" ---
  const [reference, setReference] = useState("");
  const [itemId, setItemId] = useState("");
  const [saleType, setSaleType] = useState<SaleType>("unit");
  const [quantity, setQuantity] = useState(1);

  // --- Carrito y campos a nivel de venta ---
  const [cart, setCart] = useState<CartLine[]>([]);
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
      setCart([]);
      setAmountReceived("");
    }
  }, [state.success, state.saleId, router]);

  // Unidades ya comprometidas en el carrito para el producto seleccionado.
  const committedUnits = useMemo(
    () =>
      cart
        .filter((l) => l.inventoryId === selected?.id)
        .reduce((sum, l) => sum + lineUnits(l.saleType, l.quantity), 0),
    [cart, selected],
  );

  const unitsNeeded = lineUnits(saleType, quantity);
  const availableUnits = selected ? selected.quantity - committedUnits : 0;
  const maxQty = selected
    ? saleType === "dozen"
      ? Math.floor(availableUnits / UNITS_PER_DOZEN)
      : availableUnits
    : 0;
  const insufficientStock = selected ? unitsNeeded > availableUnits : false;
  const canAdd = !!selected && quantity > 0 && !insufficientStock;

  // --- Totales del carrito ---
  const cartLines = useMemo(
    () =>
      cart.map((l) => {
        const item = items.find((i) => i.id === l.inventoryId)!;
        return {
          ...l,
          item,
          units: lineUnits(l.saleType, l.quantity),
          total: lineTotal(item, l.saleType, l.quantity),
        };
      }),
    [cart, items],
  );
  const grandTotal = cartLines.reduce((sum, l) => sum + l.total, 0);
  const totalUnits = cartLines.reduce((sum, l) => sum + l.units, 0);

  const received = Number(amountReceived);
  const hasReceived = amountReceived !== "" && !Number.isNaN(received);
  const diff = hasReceived ? received - grandTotal : 0;

  function addLine() {
    if (!selected || !canAdd) return;
    setCart((c) => [
      ...c,
      {
        inventoryId: selected.id,
        reference: selected.reference,
        size: selected.size,
        saleType,
        quantity,
      },
    ]);
    // Reiniciar el sub-formulario para agregar otra línea.
    setReference("");
    setItemId("");
    setSaleType("unit");
    setQuantity(1);
  }

  function removeLine(index: number) {
    setCart((c) => c.filter((_, i) => i !== index));
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* Agregar producto al carrito */}
        <Card className="p-5">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">
            Agregar producto
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
                  onChange={(e) => setItemId(e.target.value)}
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

            {/* Tipo de venta y cantidad */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">
                  Tipo de venta
                </label>
                <select
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
                  type="number"
                  min={1}
                  step={1}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(Math.max(1, Number(e.target.value)))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                {selected && (
                  <p className="text-xs text-slate-500">
                    Disponible (sin lo ya agregado): {availableUnits} unidad(es) ·
                    Máximo {maxQty} {saleType === "dozen" ? "docena(s)" : "unidad(es)"} ·
                    Descuenta {unitsNeeded} unidad(es)
                  </p>
                )}
              </div>
            </div>

            {insufficientStock && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                Stock insuficiente: se requieren {unitsNeeded} unidad(es) y quedan{" "}
                {availableUnits} disponible(s) (descontando lo ya agregado).
              </p>
            )}

            <button
              type="button"
              onClick={addLine}
              disabled={!canAdd}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              Agregar a la venta
            </button>
          </div>
        </Card>

        {/* Carrito + datos de la venta */}
        <Card className="p-5">
          <form action={formAction} className="space-y-4">
            <FieldError message={state.error} />
            <SuccessMessage message={state.success} />

            <h2 className="text-lg font-semibold text-slate-900">
              Productos de la venta
            </h2>

            {cartLines.length === 0 ? (
              <p className="rounded-md bg-slate-50 px-3 py-3 text-sm text-slate-500">
                Aún no has agregado productos. Usa el formulario de arriba.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-1">Producto</th>
                      <th className="py-1">Tipo</th>
                      <th className="py-1 text-right">Cant.</th>
                      <th className="py-1 text-right">Subtotal</th>
                      <th className="py-1"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cartLines.map((l, idx) => (
                      <tr key={idx}>
                        <td className="py-2 font-medium text-slate-900">
                          {l.reference} · {l.size}
                        </td>
                        <td className="py-2">{SALE_TYPE_LABELS[l.saleType]}</td>
                        <td className="py-2 text-right">
                          {l.quantity}
                          {l.saleType === "dozen" ? " doc." : ""}
                        </td>
                        <td className="py-2 text-right font-semibold">
                          {formatCOP(l.total)}
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

            {/* Líneas de la venta serializadas para el server action */}
            <input
              type="hidden"
              name="items"
              value={JSON.stringify(
                cart.map((l) => ({
                  inventoryId: l.inventoryId,
                  saleType: l.saleType,
                  quantity: l.quantity,
                })),
              )}
            />

            <button
              type="submit"
              disabled={pending || cart.length === 0}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {pending ? "Registrando…" : "Registrar venta"}
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
            <dd className="font-medium">{cartLines.length}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Unidades a descontar</dt>
            <dd className="font-medium">{totalUnits}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2">
            <dt className="font-semibold text-slate-700">Total esperado</dt>
            <dd className="text-lg font-bold text-slate-900">
              {formatCOP(grandTotal)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Monto recibido</dt>
            <dd className="font-medium">
              {hasReceived ? formatCOP(received) : "—"}
            </dd>
          </div>
        </dl>

        {hasReceived && diff !== 0 && grandTotal > 0 && (
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
        {hasReceived && diff === 0 && grandTotal > 0 && (
          <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            El monto recibido coincide con el total esperado.
          </div>
        )}
      </Card>
    </div>
  );
}
