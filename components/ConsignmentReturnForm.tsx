"use client";

import { useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  createConsignmentReturn,
  type ConsignmentState,
} from "@/app/actions/consignments";
import { Card, FieldError, SuccessMessage } from "@/components/ui";

// Una existencia en poder del consignatario (lo que puede devolver).
export interface HoldingItem {
  reference: string;
  size: string;
  quantity: number;
}

// Línea agregada al carrito de la devolución.
interface CartLine {
  reference: string;
  size: string;
  quantity: number;
}

const initialState: ConsignmentState = {};

// Clave estable de una existencia (referencia+talla).
function keyOf(reference: string, size: string): string {
  return JSON.stringify([reference, size]);
}

export default function ConsignmentReturnForm({
  consigneeId,
  holdings,
}: {
  consigneeId: number;
  holdings: HoldingItem[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    createConsignmentReturn,
    initialState,
  );

  // --- Sub-formulario "agregar línea" ---
  const [holdingKey, setHoldingKey] = useState("");
  const [quantityInput, setQuantityInput] = useState("1");
  const quantity = Math.floor(Number(quantityInput)) || 0;

  const [cart, setCart] = useState<CartLine[]>([]);

  const selected = useMemo(
    () => holdings.find((h) => keyOf(h.reference, h.size) === holdingKey),
    [holdings, holdingKey],
  );

  const [handledEventId, setHandledEventId] = useState<number | undefined>(
    undefined,
  );
  if (state.eventId !== undefined && state.eventId !== handledEventId) {
    setHandledEventId(state.eventId);
    setHoldingKey("");
    setQuantityInput("1");
    setCart([]);
  }

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, state.eventId, router]);

  // Unidades ya comprometidas en el carrito para la existencia seleccionada.
  const committed = useMemo(
    () =>
      cart
        .filter(
          (l) =>
            selected &&
            l.reference === selected.reference &&
            l.size === selected.size,
        )
        .reduce((sum, l) => sum + l.quantity, 0),
    [cart, selected],
  );

  const available = selected ? selected.quantity - committed : 0;
  const insufficient = selected ? quantity > available : false;
  const canAdd = !!selected && quantity > 0 && !insufficient;

  const totalUnits = cart.reduce((sum, l) => sum + l.quantity, 0);

  function addLine() {
    if (!selected || !canAdd) return;
    setCart((c) => [
      ...c,
      { reference: selected.reference, size: selected.size, quantity },
    ]);
    setHoldingKey("");
    setQuantityInput("1");
  }

  function removeLine(index: number) {
    setCart((c) => c.filter((_, i) => i !== index));
  }

  if (holdings.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-sm text-slate-500">
          Este consignatario no tiene productos en su poder.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">
        Registrar devolución al almacén
      </h2>

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">
              Producto en consignación
            </label>
            <select
              value={holdingKey}
              onChange={(e) => setHoldingKey(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Selecciona…
              </option>
              {holdings.map((h) => (
                <option key={keyOf(h.reference, h.size)} value={keyOf(h.reference, h.size)}>
                  {h.reference} · {h.size} (en poder: {h.quantity})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">
              Cantidad a devolver
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={quantityInput}
              onChange={(e) => setQuantityInput(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            {selected && (
              <p className="text-xs text-slate-500">
                En poder (sin lo ya agregado): {available} unidad(es)
              </p>
            )}
          </div>
        </div>

        {insufficient && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            No puede devolver {quantity}: solo tiene {available} en su poder
            (descontando lo ya agregado).
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

      <form action={formAction} className="mt-5 space-y-4 border-t border-slate-100 pt-5">
        <FieldError message={state.error} />
        <SuccessMessage message={state.success} />

        {cart.length === 0 ? (
          <p className="rounded-md bg-slate-50 px-3 py-3 text-sm text-slate-500">
            Aún no has agregado productos a la devolución.
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
                {cart.map((l, idx) => (
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

        <p className="text-sm text-slate-600">
          Total a reingresar al almacén:{" "}
          <span className="font-semibold text-slate-900">{totalUnits}</span>{" "}
          unidad(es)
        </p>

        <input type="hidden" name="consigneeId" value={consigneeId} />
        <input type="hidden" name="items" value={JSON.stringify(cart)} />

        <button
          type="submit"
          disabled={pending || cart.length === 0}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Registrando…" : "Registrar devolución"}
        </button>
      </form>
    </Card>
  );
}
