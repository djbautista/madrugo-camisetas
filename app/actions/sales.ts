"use server";

import { revalidatePath } from "next/cache";
import { getDb, nowISO } from "@/lib/db";
import { requireRole } from "@/lib/session";
import {
  UNITS_PER_DOZEN,
  type InventoryRow,
  type PaymentMethod,
  type SaleType,
} from "@/lib/types";

export interface SaleState {
  error?: string;
  success?: string;
  saleId?: number;
}

const VALID_PAYMENTS: PaymentMethod[] = [
  "efectivo",
  "nequi",
  "daviplata",
  "transferencia",
  "otro",
];

// Línea cruda recibida del formulario (campo oculto `items`, JSON). Los precios
// NO se confían al cliente: se recalculan desde el inventario en el servidor.
interface RawItem {
  inventoryId: number;
  saleType: SaleType;
  quantity: number;
}

// Línea ya validada y con precios/unidades calculados desde el inventario.
interface PricedItem {
  inv: InventoryRow;
  saleType: SaleType;
  quantity: number;
  unitsDeducted: number;
  pricePerShirt: number;
  totalAmount: number;
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
    const saleType = e.saleType as SaleType;
    const quantity = Number(e.quantity);
    if (!Number.isInteger(inventoryId) || inventoryId <= 0) return null;
    if (saleType !== "unit" && saleType !== "dozen") return null;
    if (!Number.isInteger(quantity) || quantity <= 0) return null;
    items.push({ inventoryId, saleType, quantity });
  }
  return items;
}

export async function createSale(
  _prevState: SaleState,
  formData: FormData,
): Promise<SaleState> {
  // Solo Administrador y Vendedor pueden registrar ventas.
  const session = await requireRole("admin", "seller");

  const amountReceived = Number(formData.get("amountReceived"));
  const customerName = String(formData.get("customerName") ?? "").trim();
  const paymentMethod = String(
    formData.get("paymentMethod") ?? "",
  ) as PaymentMethod;
  const observations = String(formData.get("observations") ?? "").trim();
  const items = parseItems(formData.get("items"));

  // --- Validaciones a nivel de venta ---
  if (!items) {
    return { error: "Agrega al menos un producto válido a la venta." };
  }
  if (!customerName) {
    return { error: "El nombre del cliente es obligatorio." };
  }
  if (!VALID_PAYMENTS.includes(paymentMethod)) {
    return { error: "Selecciona un método de pago." };
  }
  if (Number.isNaN(amountReceived) || amountReceived < 0) {
    return { error: "El monto recibido no es válido." };
  }

  const db = await getDb();
  const tx = await db.transaction("write");

  try {
    // --- Primer paso: validar y calcular precios/unidades desde inventario ---
    const priced: PricedItem[] = [];
    // Unidades totales a descontar por producto (agrega líneas duplicadas para
    // que el descuento defensivo sea correcto y no permita sobreventa).
    const unitsByInventory = new Map<number, number>();
    let grandTotal = 0;

    for (const item of items) {
      const invRes = await tx.execute({
        sql: "SELECT * FROM inventory WHERE id = ?",
        args: [item.inventoryId],
      });
      const inv = invRes.rows[0] as unknown as InventoryRow | undefined;

      if (!inv) {
        throw new Error("Uno de los productos seleccionados ya no existe.");
      }
      if (item.saleType === "dozen" && inv.dozen_price == null) {
        throw new Error(
          `"${inv.reference} · ${inv.size}" no tiene precio por docena.`,
        );
      }

      const unitsDeducted =
        item.saleType === "dozen"
          ? item.quantity * UNITS_PER_DOZEN
          : item.quantity;
      // `dozen_price` es el precio POR UNIDAD cuando se vende por docena (mayorista).
      const pricePerShirt =
        item.saleType === "dozen"
          ? (inv.dozen_price as number)
          : inv.unit_price;
      const totalAmount =
        item.saleType === "dozen"
          ? item.quantity * UNITS_PER_DOZEN * (inv.dozen_price as number)
          : item.quantity * inv.unit_price;

      grandTotal += totalAmount;
      unitsByInventory.set(
        item.inventoryId,
        (unitsByInventory.get(item.inventoryId) ?? 0) + unitsDeducted,
      );
      priced.push({
        inv,
        saleType: item.saleType,
        quantity: item.quantity,
        unitsDeducted,
        pricePerShirt,
        totalAmount,
      });
    }

    // Comprobación de stock por producto (sobre el total agregado).
    for (const [inventoryId, neededUnits] of unitsByInventory) {
      const inv = priced.find((p) => p.inv.id === inventoryId)!.inv;
      if (neededUnits > inv.quantity) {
        throw new Error(
          `Stock insuficiente en "${inv.reference} · ${inv.size}": disponible ${inv.quantity} unidad(es), se requieren ${neededUnits}.`,
        );
      }
    }

    const createdAt = nowISO();

    // --- Cabecera de la venta ---
    const sale = await tx.execute({
      sql: `INSERT INTO sales
              (total_amount, amount_received, seller_id, seller_name,
               customer_name, payment_method, observations, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        grandTotal,
        amountReceived,
        session.userId,
        session.name,
        customerName,
        paymentMethod,
        observations || null,
        createdAt,
      ],
    });
    const saleId = Number(sale.lastInsertRowid);

    // --- Descuento de stock defensivo (uno por producto, con el total agregado) ---
    // La condición quantity >= ? evita condiciones de carrera; el
    // CHECK (quantity >= 0) es la última barrera.
    for (const [inventoryId, neededUnits] of unitsByInventory) {
      const update = await tx.execute({
        sql: "UPDATE inventory SET quantity = quantity - ?, updated_at = ? WHERE id = ? AND quantity >= ?",
        args: [neededUnits, createdAt, inventoryId, neededUnits],
      });
      if (update.rowsAffected !== 1) {
        throw new Error("No se pudo descontar el stock. Intenta de nuevo.");
      }
    }

    // --- Líneas y movimientos ---
    // El dinero recibido es a nivel de venta: se registra una sola vez (en el
    // primer movimiento) para no contarlo varias veces en el libro.
    let first = true;
    for (const p of priced) {
      await tx.execute({
        sql: `INSERT INTO sale_items
                (sale_id, sale_type, reference, size, quantity, units_deducted,
                 price_per_shirt, total_amount)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          saleId,
          p.saleType,
          p.inv.reference,
          p.inv.size,
          p.quantity,
          p.unitsDeducted,
          p.pricePerShirt,
          p.totalAmount,
        ],
      });

      await tx.execute({
        sql: `INSERT INTO movements
                (type, user_id, user_name, reference, size, quantity_moved,
                 money_received, payment_method, sale_id, observations, created_at)
               VALUES ('sale', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          session.userId,
          session.name,
          p.inv.reference,
          p.inv.size,
          -p.unitsDeducted,
          first ? amountReceived : null,
          paymentMethod,
          saleId,
          observations || null,
          createdAt,
        ],
      });
      first = false;
    }

    await tx.commit();

    revalidatePath("/ventas");
    revalidatePath("/inventario");
    revalidatePath("/reportes");
    revalidatePath("/movimientos");
    revalidatePath("/");

    return { success: "Venta registrada correctamente.", saleId };
  } catch (err) {
    await tx.rollback();
    return {
      error:
        err instanceof Error
          ? err.message
          : "Ocurrió un error al registrar la venta.",
    };
  }
}
