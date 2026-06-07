"use server";

import { revalidatePath } from "next/cache";
import { getDb, nowISO } from "@/lib/db";
import { requireRole } from "@/lib/session";
import type { InventoryRow, PaymentMethod } from "@/lib/types";

export interface ReturnState {
  error?: string;
  success?: string;
  returnId?: number;
}

const VALID_PAYMENTS: PaymentMethod[] = [
  "efectivo",
  "nequi",
  "daviplata",
  "transferencia",
  "otro",
];

// Línea cruda recibida del formulario (campo oculto `items`, JSON).
//
// A diferencia de las ventas, el monto a devolver SÍ se acepta del cliente
// (validado >= 0): la devolución es libre (no está ligada a una venta), así
// que no hay precio original del cual derivarlo y el administrador puede
// ajustar el monto (p. ej. reembolso parcial). Solo administradores llegan
// hasta aquí.
interface RawItem {
  inventoryId: number;
  quantity: number;
  restock: boolean;
  refundAmount: number;
}

// Línea ya validada con su producto de inventario cargado.
interface ResolvedItem {
  inv: InventoryRow;
  quantity: number;
  restock: boolean;
  refundAmount: number;
}

function parseItems(raw: unknown): RawItem[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(raw ?? ""));
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null;

  const items: RawItem[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) return null;
    const e = entry as Record<string, unknown>;
    const inventoryId = Number(e.inventoryId);
    const quantity = Number(e.quantity);
    const restock = e.restock;
    const refundAmount = Number(e.refundAmount);
    if (!Number.isInteger(inventoryId) || inventoryId <= 0) return null;
    if (!Number.isInteger(quantity) || quantity <= 0) return null;
    if (typeof restock !== "boolean") return null;
    if (!Number.isFinite(refundAmount) || refundAmount < 0) return null;
    items.push({ inventoryId, quantity, restock, refundAmount });
  }
  return items;
}

export async function createReturn(
  _prevState: ReturnState,
  formData: FormData,
): Promise<ReturnState> {
  // Solo el Administrador puede registrar devoluciones.
  const session = await requireRole("admin");

  const customerName = String(formData.get("customerName") ?? "").trim();
  const paymentMethod = String(
    formData.get("paymentMethod") ?? "",
  ) as PaymentMethod;
  const observations = String(formData.get("observations") ?? "").trim();
  const items = parseItems(formData.get("items"));

  // --- Validaciones a nivel de devolución ---
  if (!items) {
    return { error: "Agrega al menos un producto válido a la devolución." };
  }
  if (!VALID_PAYMENTS.includes(paymentMethod)) {
    return { error: "Selecciona un método de reembolso." };
  }

  const db = await getDb();
  const tx = await db.transaction("write");

  try {
    // --- Primer paso: validar productos contra el inventario ---
    const resolved: ResolvedItem[] = [];
    // Unidades totales a reingresar por producto (agrega líneas duplicadas).
    const restockByInventory = new Map<number, number>();
    let totalRefund = 0;

    for (const item of items) {
      const invRes = await tx.execute({
        sql: "SELECT * FROM inventory WHERE id = ?",
        args: [item.inventoryId],
      });
      const inv = invRes.rows[0] as unknown as InventoryRow | undefined;

      if (!inv) {
        throw new Error("Uno de los productos seleccionados ya no existe.");
      }

      totalRefund += item.refundAmount;
      if (item.restock) {
        restockByInventory.set(
          item.inventoryId,
          (restockByInventory.get(item.inventoryId) ?? 0) + item.quantity,
        );
      }
      resolved.push({
        inv,
        quantity: item.quantity,
        restock: item.restock,
        refundAmount: item.refundAmount,
      });
    }

    const createdAt = nowISO();

    // --- Cabecera de la devolución ---
    const ret = await tx.execute({
      sql: `INSERT INTO returns
              (total_refund, user_id, user_name, customer_name,
               payment_method, observations, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        totalRefund,
        session.userId,
        session.name,
        customerName || null,
        paymentMethod,
        observations || null,
        createdAt,
      ],
    });
    const returnId = Number(ret.lastInsertRowid);

    // --- Reingreso de stock (uno por producto, con el total agregado) ---
    // Solo suma, así que no hace falta guarda contra carreras.
    for (const [inventoryId, units] of restockByInventory) {
      await tx.execute({
        sql: "UPDATE inventory SET quantity = quantity + ?, updated_at = ? WHERE id = ?",
        args: [units, createdAt, inventoryId],
      });
    }

    // --- Líneas y movimientos ---
    // Cada línea genera un movimiento (también las que no reingresan, con
    // cantidad 0, para que el evento quede auditado). El dinero devuelto es a
    // nivel de devolución: se registra una sola vez (en el primer movimiento),
    // en negativo porque sale de la caja.
    let first = true;
    for (const r of resolved) {
      await tx.execute({
        sql: `INSERT INTO return_items
                (return_id, reference, size, quantity, restocked, refund_amount)
               VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          returnId,
          r.inv.reference,
          r.inv.size,
          r.quantity,
          r.restock ? 1 : 0,
          r.refundAmount,
        ],
      });

      const movementObs = r.restock
        ? observations || null
        : [observations, "Sin reingreso a inventario"]
            .filter(Boolean)
            .join(" · ");
      await tx.execute({
        sql: `INSERT INTO movements
                (type, user_id, user_name, reference, size, quantity_moved,
                 money_received, payment_method, sale_id, observations, created_at)
               VALUES ('return', ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
        args: [
          session.userId,
          session.name,
          r.inv.reference,
          r.inv.size,
          r.restock ? r.quantity : 0,
          first ? -totalRefund : null,
          paymentMethod,
          movementObs,
          createdAt,
        ],
      });
      first = false;
    }

    await tx.commit();

    revalidatePath("/devoluciones");
    revalidatePath("/inventario");
    revalidatePath("/movimientos");
    revalidatePath("/reportes");
    revalidatePath("/");

    return { success: "Devolución registrada correctamente.", returnId };
  } catch (err) {
    await tx.rollback();
    return {
      error:
        err instanceof Error
          ? err.message
          : "Ocurrió un error al registrar la devolución.",
    };
  }
}
