"use server";

import { revalidatePath } from "next/cache";
import { getDb, nowISO } from "@/lib/db";
import { requireRole } from "@/lib/session";
import type { ConsigneeRow, InventoryRow } from "@/lib/types";

// Acciones de consignación (solo seguimiento de stock, sin dinero):
//  - createDelivery: entrega stock a un consignatario (sale del almacén).
//  - createConsignmentReturn: el consignatario regresa lo no vendido al almacén.
// Solo administradores. Mismo esqueleto transaccional que ventas/devoluciones.

export interface ConsignmentState {
  error?: string;
  success?: string;
  eventId?: number;
}

function revalidateConsignment(consigneeId: number): void {
  revalidatePath("/consignaciones");
  revalidatePath(`/consignaciones/${consigneeId}`);
  revalidatePath("/inventario");
  revalidatePath("/movimientos");
  revalidatePath("/");
}

// --- Entrega (out) ---

// Línea cruda del formulario de entrega (campo oculto `items`, JSON). El
// producto se elige del inventario por id, igual que en una venta.
interface RawDeliveryItem {
  inventoryId: number;
  quantity: number;
}

function parseDeliveryItems(raw: unknown): RawDeliveryItem[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(raw ?? ""));
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null;

  const items: RawDeliveryItem[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) return null;
    const e = entry as Record<string, unknown>;
    const inventoryId = Number(e.inventoryId);
    const quantity = Number(e.quantity);
    if (!Number.isInteger(inventoryId) || inventoryId <= 0) return null;
    if (!Number.isInteger(quantity) || quantity <= 0) return null;
    items.push({ inventoryId, quantity });
  }
  return items;
}

export async function createDelivery(
  _prev: ConsignmentState,
  formData: FormData,
): Promise<ConsignmentState> {
  const session = await requireRole("admin");

  const consigneeId = Number(formData.get("consigneeId"));
  const observations = String(formData.get("observations") ?? "").trim();
  const items = parseDeliveryItems(formData.get("items"));

  if (!consigneeId || Number.isNaN(consigneeId)) {
    return { error: "Selecciona un consignatario." };
  }
  if (!items) {
    return { error: "Agrega al menos un producto válido a la entrega." };
  }

  const db = await getDb();
  const tx = await db.transaction("write");

  try {
    // Consignatario debe existir y estar activo para recibir más stock.
    const consigneeRes = await tx.execute({
      sql: "SELECT * FROM consignees WHERE id = ?",
      args: [consigneeId],
    });
    const consignee = consigneeRes.rows[0] as unknown as ConsigneeRow | undefined;
    if (!consignee) throw new Error("El consignatario seleccionado no existe.");
    if (consignee.active !== 1) {
      throw new Error("El consignatario está desactivado; actívalo para entregarle stock.");
    }

    // Validar productos y agregar unidades por inventoryId (líneas duplicadas)
    // para que la guarda defensiva no permita sobreentrega.
    const resolved: { inv: InventoryRow; quantity: number }[] = [];
    const unitsByInventory = new Map<number, number>();
    let totalUnits = 0;

    for (const item of items) {
      const invRes = await tx.execute({
        sql: "SELECT * FROM inventory WHERE id = ?",
        args: [item.inventoryId],
      });
      const inv = invRes.rows[0] as unknown as InventoryRow | undefined;
      if (!inv) throw new Error("Uno de los productos seleccionados ya no existe.");

      totalUnits += item.quantity;
      unitsByInventory.set(
        item.inventoryId,
        (unitsByInventory.get(item.inventoryId) ?? 0) + item.quantity,
      );
      resolved.push({ inv, quantity: item.quantity });
    }

    for (const [inventoryId, needed] of unitsByInventory) {
      const inv = resolved.find((r) => r.inv.id === inventoryId)!.inv;
      if (needed > inv.quantity) {
        throw new Error(
          `Stock insuficiente en "${inv.reference} · ${inv.size}": disponible ${inv.quantity} unidad(es), se requieren ${needed}.`,
        );
      }
    }

    const createdAt = nowISO();

    // Cabecera del evento de entrega.
    const event = await tx.execute({
      sql: `INSERT INTO consignment_events
              (type, consignee_id, consignee_name, user_id, user_name,
               total_units, observations, created_at)
             VALUES ('out', ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        consigneeId,
        consignee.name,
        session.userId,
        session.name,
        totalUnits,
        observations || null,
        createdAt,
      ],
    });
    const eventId = Number(event.lastInsertRowid);

    // Descuento defensivo del almacén (uno por producto, con el total agregado).
    for (const [inventoryId, needed] of unitsByInventory) {
      const update = await tx.execute({
        sql: "UPDATE inventory SET quantity = quantity - ?, updated_at = ? WHERE id = ? AND quantity >= ?",
        args: [needed, createdAt, inventoryId, needed],
      });
      if (update.rowsAffected !== 1) {
        throw new Error("No se pudo descontar el stock. Intenta de nuevo.");
      }
    }

    // Líneas del evento + existencias del consignatario (upsert) + movimientos.
    const obsBase = `Consignación → ${consignee.name}`;
    for (const r of resolved) {
      await tx.execute({
        sql: `INSERT INTO consignment_event_items (event_id, reference, size, quantity)
              VALUES (?, ?, ?, ?)`,
        args: [eventId, r.inv.reference, r.inv.size, r.quantity],
      });

      await tx.execute({
        sql: `INSERT INTO consignment_stock (consignee_id, reference, size, quantity, updated_at)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(consignee_id, reference, size) DO UPDATE SET
                quantity   = quantity + excluded.quantity,
                updated_at = excluded.updated_at`,
        args: [consigneeId, r.inv.reference, r.inv.size, r.quantity, createdAt],
      });

      await tx.execute({
        sql: `INSERT INTO movements
                (type, user_id, user_name, reference, size, quantity_moved,
                 money_received, payment_method, sale_id, observations, created_at)
               VALUES ('consignment_out', ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)`,
        args: [
          session.userId,
          session.name,
          r.inv.reference,
          r.inv.size,
          -r.quantity,
          observations ? `${obsBase} · ${observations}` : obsBase,
          createdAt,
        ],
      });
    }

    await tx.commit();
    revalidateConsignment(consigneeId);
    return { success: "Entrega en consignación registrada correctamente.", eventId };
  } catch (err) {
    await tx.rollback();
    return {
      error:
        err instanceof Error
          ? err.message
          : "Ocurrió un error al registrar la entrega.",
    };
  }
}

// --- Devolución / regreso (in) ---

// Línea cruda del formulario de devolución. Se resuelve por referencia+talla
// (no por id de inventario): un "importar (reemplazar)" reescribe los ids, pero
// consignment_stock guarda strings y sobrevive.
interface RawReturnItem {
  reference: string;
  size: string;
  quantity: number;
}

function parseReturnItems(raw: unknown): RawReturnItem[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(raw ?? ""));
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null;

  const items: RawReturnItem[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) return null;
    const e = entry as Record<string, unknown>;
    const reference = String(e.reference ?? "").trim();
    const size = String(e.size ?? "").trim();
    const quantity = Number(e.quantity);
    if (!reference || !size) return null;
    if (!Number.isInteger(quantity) || quantity <= 0) return null;
    items.push({ reference, size, quantity });
  }
  return items;
}

export async function createConsignmentReturn(
  _prev: ConsignmentState,
  formData: FormData,
): Promise<ConsignmentState> {
  const session = await requireRole("admin");

  const consigneeId = Number(formData.get("consigneeId"));
  const observations = String(formData.get("observations") ?? "").trim();
  const items = parseReturnItems(formData.get("items"));

  if (!consigneeId || Number.isNaN(consigneeId)) {
    return { error: "Consignatario inválido." };
  }
  if (!items) {
    return { error: "Agrega al menos un producto válido a la devolución." };
  }

  const db = await getDb();
  const tx = await db.transaction("write");

  try {
    const consigneeRes = await tx.execute({
      sql: "SELECT * FROM consignees WHERE id = ?",
      args: [consigneeId],
    });
    const consignee = consigneeRes.rows[0] as unknown as ConsigneeRow | undefined;
    if (!consignee) throw new Error("El consignatario seleccionado no existe.");

    // Agregar por referencia+talla (líneas duplicadas) para que la guarda
    // defensiva contra el stock en consignación sea correcta.
    const qtyByKey = new Map<string, RawReturnItem>();
    let totalUnits = 0;
    for (const item of items) {
      const key = `${item.reference} ${item.size}`;
      const existing = qtyByKey.get(key);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        qtyByKey.set(key, { ...item });
      }
      totalUnits += item.quantity;
    }
    const aggregated = Array.from(qtyByKey.values());

    const createdAt = nowISO();

    // Cabecera del evento de devolución.
    const event = await tx.execute({
      sql: `INSERT INTO consignment_events
              (type, consignee_id, consignee_name, user_id, user_name,
               total_units, observations, created_at)
             VALUES ('in', ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        consigneeId,
        consignee.name,
        session.userId,
        session.name,
        totalUnits,
        observations || null,
        createdAt,
      ],
    });
    const eventId = Number(event.lastInsertRowid);

    const obsBase = `Devolución consignación ← ${consignee.name}`;
    for (const r of aggregated) {
      // Descontar defensivamente de lo que el consignatario tiene en su poder.
      const dec = await tx.execute({
        sql: `UPDATE consignment_stock SET quantity = quantity - ?, updated_at = ?
              WHERE consignee_id = ? AND reference = ? AND size = ? AND quantity >= ?`,
        args: [r.quantity, createdAt, consigneeId, r.reference, r.size, r.quantity],
      });
      if (dec.rowsAffected !== 1) {
        throw new Error(
          `"${r.reference} · ${r.size}": el consignatario no tiene esas unidades en consignación.`,
        );
      }

      // Reingresar al almacén. Resolver por referencia+talla; si la SKU ya no
      // existe en el inventario (p. ej. borrada en un importar-reemplazar), no
      // inventamos precio: se rechaza para mantener el inventario consistente.
      const invRes = await tx.execute({
        sql: "SELECT id FROM inventory WHERE reference = ? AND size = ?",
        args: [r.reference, r.size],
      });
      const inv = invRes.rows[0] as unknown as { id: number } | undefined;
      if (!inv) {
        throw new Error(
          `"${r.reference} · ${r.size}" ya no está en el inventario; impórtalo primero para poder reingresarlo.`,
        );
      }
      await tx.execute({
        sql: "UPDATE inventory SET quantity = quantity + ?, updated_at = ? WHERE id = ?",
        args: [r.quantity, createdAt, inv.id],
      });

      await tx.execute({
        sql: `INSERT INTO consignment_event_items (event_id, reference, size, quantity)
              VALUES (?, ?, ?, ?)`,
        args: [eventId, r.reference, r.size, r.quantity],
      });

      await tx.execute({
        sql: `INSERT INTO movements
                (type, user_id, user_name, reference, size, quantity_moved,
                 money_received, payment_method, sale_id, observations, created_at)
               VALUES ('consignment_in', ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)`,
        args: [
          session.userId,
          session.name,
          r.reference,
          r.size,
          r.quantity,
          observations ? `${obsBase} · ${observations}` : obsBase,
          createdAt,
        ],
      });
    }

    await tx.commit();
    revalidateConsignment(consigneeId);
    return { success: "Devolución de consignación registrada correctamente.", eventId };
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
