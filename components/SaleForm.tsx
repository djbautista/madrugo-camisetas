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
  type PaymentMethod,
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

export interface ConsigneeOption {
  id: number;
  name: string;
}

// Línea agregada al carrito de la venta.
export interface CartLine {
  inventoryId: number;
  reference: string;
  size: string;
  saleType: SaleType;
  quantity: number;
}

// Firma compartida por createSale y editSale.
type SaleAction = (
  prevState: SaleState,
  formData: FormData,
) => Promise<SaleState>;

const initialState: SaleState = {};

// Precio por camiseta de una línea, según tipo de venta.
// `dozen_price` es el precio POR UNIDAD cuando se vende por docena (mayorista).
function linePrice(item: SaleItem, saleType: SaleType): number {
  return saleType === "dozen"
    ? (item.dozen_price as number)
    : item.unit_price;
}

// Total de una línea (cantidad de unidades o docenas × precio).
function lineTotal(item: SaleItem, saleType: SaleType, quantity: number): number {
  return saleType === "dozen"
    ? quantity * UNITS_PER_DOZEN * (item.dozen_price as number)
    : quantity * item.unit_price;
}

// Unidades de stock que descuenta una línea.
function lineUnits(saleType: SaleType, quantity: number): number {
  return saleType === "dozen" ? quantity * UNITS_PER_DOZEN : quantity;
}

// Agrupador de miles en estilo es-CO ("1.234.567"), sin símbolo de moneda.
const milesFormat = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
function groupThousands(digits: string): string {
  if (digits === "") return "";
  const n = Number(digits);
  return Number.isNaN(n) ? "" : milesFormat.format(n);
}

export default function SaleForm({
  warehouseItems,
  consignees,
  consigneeItems,
  lockedConsignee,
  action = createSale,
  mode = "create",
  saleId,
  initialCart,
  initialCustomerName,
  initialPaymentMethod,
  initialAmountReceived,
  initialObservations,
}: {
  // Productos disponibles en el almacén (venta normal).
  warehouseItems: SaleItem[];
  // Consignatarios activos elegibles en el desplegable.
  consignees: ConsigneeOption[];
  // Existencias vendibles (con precio del catálogo) por id de consignatario.
  consigneeItems: Record<number, SaleItem[]>;
  // Si viene fijo (se llegó desde la tarjeta del consignatario), se oculta el
  // desplegable y la venta se hace desde su stock.
  lockedConsignee?: ConsigneeOption;
  // --- Modo edición ---
  // Server action a usar (createSale por defecto; editSale al editar).
  action?: SaleAction;
  mode?: "create" | "edit";
  // Id de la venta que se edita (se envía oculto al server action).
  saleId?: number;
  // Valores con los que precargar el formulario al editar.
  initialCart?: CartLine[];
  initialCustomerName?: string;
  initialPaymentMethod?: PaymentMethod;
  initialAmountReceived?: number;
  initialObservations?: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, initialState);
  const isEdit = mode === "edit";

  // --- Consignatario a nivel de venta ("" = almacén principal) ---
  const [consigneeId, setConsigneeId] = useState(
    lockedConsignee ? String(lockedConsignee.id) : "",
  );

  // Lista de productos activa: el stock del consignatario seleccionado, o el
  // almacén si no hay ninguno. Toda la maquinaria de abajo lee `items`.
  const items = useMemo(
    () =>
      consigneeId
        ? (consigneeItems[Number(consigneeId)] ?? [])
        : warehouseItems,
    [consigneeId, consigneeItems, warehouseItems],
  );

  // --- Sub-formulario "agregar línea" ---
  const [reference, setReference] = useState("");
  const [itemId, setItemId] = useState("");
  const [saleType, setSaleType] = useState<SaleType>("unit");
  // Texto crudo del input para permitir borrarlo mientras se escribe;
  // vacío o inválido => cantidad 0, que bloquea "Agregar a la venta".
  const [quantityInput, setQuantityInput] = useState("1");
  const quantity = Math.floor(Number(quantityInput)) || 0;

  // --- Carrito y campos a nivel de venta ---
  const [cart, setCart] = useState<CartLine[]>(initialCart ?? []);
  // El cajero teclea en miles; el sufijo "000" se completa solo (los montos son
  // siempre redondos). `receivedDigits` son los dígitos significativos tecleados.
  // Al editar se precarga desde el monto original (asumido múltiplo de mil).
  const [receivedDigits, setReceivedDigits] = useState(
    initialAmountReceived && initialAmountReceived > 0
      ? String(Math.round(initialAmountReceived / 1000))
      : "",
  );
  const [amountFocused, setAmountFocused] = useState(false);
  const amountReceived = receivedDigits === "" ? "" : `${receivedDigits}000`;

  // Cambiar de consignatario invalida el carrito (los inventoryId y precios solo
  // valen para una fuente de stock) y reinicia el sub-formulario.
  function changeConsignee(value: string) {
    setConsigneeId(value);
    setCart([]);
    setReference("");
    setItemId("");
    setSaleType("unit");
    setQuantityInput("1");
  }

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

  // Si el producto no tiene precio por docena, forzar venta por unidad
  // (ajuste de estado durante el render, con guarda).
  if (!canDozen && saleType === "dozen") setSaleType("unit");

  // Limpiar el formulario tras una venta exitosa (ajuste de estado durante el
  // render, con guarda por saleId para hacerlo una sola vez). Solo en creación:
  // al editar se redirige a /ventas, no se limpia.
  const [handledSaleId, setHandledSaleId] = useState<number | undefined>(
    undefined,
  );
  if (
    !isEdit &&
    state.saleId !== undefined &&
    state.saleId !== handledSaleId
  ) {
    setHandledSaleId(state.saleId);
    setReference("");
    setItemId("");
    setSaleType("unit");
    setQuantityInput("1");
    setCart([]);
    setReceivedDigits("");
    // Vuelve al consignatario fijo (si lo hay) o al almacén.
    setConsigneeId(lockedConsignee ? String(lockedConsignee.id) : "");
  }

  // Tras el éxito: al editar se vuelve al listado de ventas; al crear se
  // refrescan los datos del servidor (stock disponible, etc.).
  useEffect(() => {
    if (!state.success) return;
    if (isEdit) router.push("/ventas");
    else router.refresh();
  }, [state.success, state.saleId, isEdit, router]);

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
            {/* Origen del stock: almacén o un consignatario */}
            {lockedConsignee ? (
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">
                  Vendiendo desde el stock de
                </label>
                <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900">
                  {lockedConsignee.name} (consignación)
                </p>
              </div>
            ) : (
              consignees.length > 0 && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">
                    Origen del stock
                  </label>
                  <select
                    value={consigneeId}
                    onChange={(e) => changeConsignee(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:max-w-sm"
                  >
                    <option value="">Almacén principal</option>
                    {consignees.map((c) => (
                      <option key={c.id} value={c.id}>
                        Consignación · {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )
            )}

            {consigneeId && items.length === 0 && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Este consignatario no tiene productos con precio para vender.
              </p>
            )}

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
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(e.target.value)}
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
                  defaultValue={initialCustomerName}
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
                  defaultValue={initialPaymentMethod ?? ""}
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

            {/* Monto recibido — el cajero teclea en miles; el "000" se
                autocompleta atenuado (como un placeholder de autocompletado)
                mientras escribe y se fija con el mismo estilo al salir del campo. */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">
                  Monto recibido
                </label>
                <div className="relative">
                  {/* Capa de fondo: reserva el ancho de lo ya escrito (invisible)
                      y pinta el sufijo "000" atenuado, alineado justo después. */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 flex items-center whitespace-pre rounded-lg border border-transparent px-3 py-2 text-sm"
                  >
                    <span className="invisible">
                      {groupThousands(receivedDigits)}
                    </span>
                    {amountFocused && receivedDigits !== "" && (
                      <span className="text-slate-400">.000</span>
                    )}
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={
                      receivedDigits === ""
                        ? ""
                        : amountFocused
                          ? groupThousands(receivedDigits)
                          : groupThousands(amountReceived)
                    }
                    onChange={(e) =>
                      setReceivedDigits(
                        e.target.value.replace(/\D/g, "").replace(/^0+/, ""),
                      )
                    }
                    onFocus={() => setAmountFocused(true)}
                    onBlur={() => setAmountFocused(false)}
                    placeholder="0"
                    className="relative w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm"
                  />
                </div>
                {/* Valor numérico limpio (sin separadores) para el server action. */}
                <input type="hidden" name="amountReceived" value={amountReceived} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">
                Observaciones (opcional)
              </label>
              <textarea
                name="observations"
                rows={2}
                defaultValue={initialObservations}
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
            {/* Consignatario (vacío = venta del almacén). Al editar el origen
                queda fijo: el server lo toma de la venta original, no de aquí. */}
            <input type="hidden" name="consigneeId" value={consigneeId} />
            {/* Id de la venta a editar (solo en modo edición). */}
            {isEdit && saleId !== undefined && (
              <input type="hidden" name="saleId" value={saleId} />
            )}

            <button
              type="submit"
              disabled={pending || cart.length === 0}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isEdit
                ? pending
                  ? "Guardando…"
                  : "Guardar cambios"
                : pending
                  ? "Registrando…"
                  : "Registrar venta"}
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
