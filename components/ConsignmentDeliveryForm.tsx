"use client";

import { useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { createDelivery, type ConsignmentState } from "@/app/actions/consignments";
import { Card, FieldError, SuccessMessage } from "@/components/ui";

// Producto de inventario disponible para entregar.
export interface DeliveryItem {
  id: number;
  reference: string;
  size: string;
  quantity: number;
}

export interface ConsigneeOption {
  id: number;
  name: string;
}

// Línea agregada al carrito de la entrega.
interface CartLine {
  inventoryId: number;
  reference: string;
  size: string;
  quantity: number;
}

const initialState: ConsignmentState = {};

export default function ConsignmentDeliveryForm({
  items,
  consignees,
  lockedConsignee,
}: {
  items: DeliveryItem[];
  consignees: ConsigneeOption[];
  // Si viene un consignatario fijo (se llegó desde su tarjeta), se oculta el
  // desplegable y se entrega directamente a esa persona.
  lockedConsignee?: ConsigneeOption;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createDelivery, initialState);

  // --- Datos a nivel de entrega ---
  const [consigneeId, setConsigneeId] = useState(
    lockedConsignee ? String(lockedConsignee.id) : "",
  );

  // --- Sub-formulario "agregar línea" ---
  const [reference, setReference] = useState("");
  const [itemId, setItemId] = useState("");
  // Texto crudo del input para permitir borrarlo mientras se escribe.
  const [quantityInput, setQuantityInput] = useState("1");
  const quantity = Math.floor(Number(quantityInput)) || 0;

  // --- Carrito ---
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

  // Limpiar el formulario tras una entrega exitosa.
  const [handledEventId, setHandledEventId] = useState<number | undefined>(
    undefined,
  );
  if (state.eventId !== undefined && state.eventId !== handledEventId) {
    setHandledEventId(state.eventId);
    setReference("");
    setItemId("");
    setQuantityInput("1");
    setCart([]);
    setConsigneeId(lockedConsignee ? String(lockedConsignee.id) : "");
  }

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, state.eventId, router]);

  // Unidades ya comprometidas en el carrito para el producto seleccionado.
  const committedUnits = useMemo(
    () =>
      cart
        .filter((l) => l.inventoryId === selected?.id)
        .reduce((sum, l) => sum + l.quantity, 0),
    [cart, selected],
  );

  const availableUnits = selected ? selected.quantity - committedUnits : 0;
  const insufficientStock = selected ? quantity > availableUnits : false;
  const canAdd = !!selected && quantity > 0 && !insufficientStock;

  const cartLines = useMemo(
    () =>
      cart.map((l) => ({
        ...l,
        item: items.find((i) => i.id === l.inventoryId),
      })),
    [cart, items],
  );
  const totalUnits = cartLines.reduce((sum, l) => sum + l.quantity, 0);

  function addLine() {
    if (!selected || !canAdd) return;
    setCart((c) => [
      ...c,
      {
        inventoryId: selected.id,
        reference: selected.reference,
        size: selected.size,
        quantity,
      },
    ]);
    setReference("");
    setItemId("");
    setQuantityInput("1");
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

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">
                Cantidad (unidades)
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={quantityInput}
                onChange={(e) => setQuantityInput(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:max-w-[12rem]"
              />
              {selected && (
                <p className="text-xs text-slate-500">
                  Disponible (sin lo ya agregado): {availableUnits} unidad(es)
                </p>
              )}
            </div>

            {insufficientStock && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                Stock insuficiente: se requieren {quantity} unidad(es) y quedan{" "}
                {availableUnits} disponible(s) (descontando lo ya agregado).
              </p>
            )}

            <button
              type="button"
              onClick={addLine}
              disabled={!canAdd}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              Agregar a la entrega
            </button>
          </div>
        </Card>

        {/* Carrito + datos de la entrega */}
        <Card className="p-5">
          <form action={formAction} className="space-y-4">
            <FieldError message={state.error} />
            <SuccessMessage message={state.success} />

            <h2 className="text-lg font-semibold text-slate-900">
              Productos a entregar
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
                      <th className="py-1 text-right">Cant.</th>
                      <th className="py-1"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cartLines.map((l, idx) => (
                      <tr key={idx}>
                        <td className="py-2 font-medium text-slate-900">
                          {l.reference} · {l.size}
                        </td>
                        <td className="py-2 text-right">{l.quantity}</td>
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

            {lockedConsignee ? (
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">
                  Consignatario
                </label>
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900">
                  {lockedConsignee.name}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">
                  Consignatario
                </label>
                <select
                  value={consigneeId}
                  onChange={(e) => setConsigneeId(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:max-w-sm"
                >
                  <option value="" disabled>
                    Selecciona…
                  </option>
                  {consignees.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {consignees.length === 0 && (
                  <p className="text-xs text-amber-700">
                    No hay consignatarios activos. Crea uno en la sección
                    Consignaciones.
                  </p>
                )}
              </div>
            )}

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

            <input type="hidden" name="consigneeId" value={consigneeId} />
            <input
              type="hidden"
              name="items"
              value={JSON.stringify(
                cart.map((l) => ({
                  inventoryId: l.inventoryId,
                  quantity: l.quantity,
                })),
              )}
            />

            <button
              type="submit"
              disabled={pending || cart.length === 0 || !consigneeId}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {pending ? "Registrando…" : "Registrar entrega"}
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
          <div className="flex justify-between border-t border-slate-200 pt-2">
            <dt className="font-semibold text-slate-700">Unidades a entregar</dt>
            <dd className="text-lg font-bold text-slate-900">{totalUnits}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-slate-500">
          Estas unidades salen del almacén y quedan en poder del consignatario.
        </p>
      </Card>
    </div>
  );
}
