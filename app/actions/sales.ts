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

export async function createSale(
  _prevState: SaleState,
  formData: FormData,
): Promise<SaleState> {
  // Solo Administrador y Vendedor pueden registrar ventas.
  const session = await requireRole("admin", "seller");

  const inventoryId = Number(formData.get("inventoryId"));
  const saleType = String(formData.get("saleType")) as SaleType;
  const quantity = Number(formData.get("quantity"));
  const amountReceived = Number(formData.get("amountReceived"));
  const customerName = String(formData.get("customerName") ?? "").trim();
  const paymentMethod = String(
    formData.get("paymentMethod") ?? "",
  ) as PaymentMethod;
  const observations = String(formData.get("observations") ?? "").trim();

  // --- Validaciones ---
  if (!inventoryId || Number.isNaN(inventoryId)) {
    return { error: "Selecciona un producto válido." };
  }
  if (saleType !== "unit" && saleType !== "dozen") {
    return { error: "Selecciona el tipo de venta." };
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { error: "La cantidad debe ser un número entero mayor a cero." };
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
    const invRes = await tx.execute({
      sql: "SELECT * FROM inventory WHERE id = ?",
      args: [inventoryId],
    });
    const inv = invRes.rows[0] as unknown as InventoryRow | undefined;

    if (!inv) {
      throw new Error("El producto seleccionado ya no existe.");
    }

    if (saleType === "dozen" && inv.dozen_price == null) {
      throw new Error("Este producto no tiene precio por docena.");
    }

    const unitsDeducted =
      saleType === "dozen" ? quantity * UNITS_PER_DOZEN : quantity;

    if (unitsDeducted > inv.quantity) {
      throw new Error(
        `Stock insuficiente: disponible ${inv.quantity} unidad(es), se requieren ${unitsDeducted}.`,
      );
    }

    const pricePerShirt =
      saleType === "dozen"
        ? (inv.dozen_price as number) / UNITS_PER_DOZEN
        : inv.unit_price;
    const totalAmount =
      saleType === "dozen"
        ? quantity * (inv.dozen_price as number)
        : quantity * inv.unit_price;

    const createdAt = nowISO();

    // Descuento de stock defensivo: la condición quantity >= ? evita
    // condiciones de carrera; el CHECK (quantity >= 0) es la última barrera.
    const update = await tx.execute({
      sql: "UPDATE inventory SET quantity = quantity - ?, updated_at = ? WHERE id = ? AND quantity >= ?",
      args: [unitsDeducted, createdAt, inventoryId, unitsDeducted],
    });

    if (update.rowsAffected !== 1) {
      throw new Error("No se pudo descontar el stock. Intenta de nuevo.");
    }

    const sale = await tx.execute({
      sql: `INSERT INTO sales
              (sale_type, reference, size, quantity, units_deducted, price_per_shirt,
               total_amount, amount_received, seller_id, seller_name, customer_name,
               payment_method, observations, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        saleType,
        inv.reference,
        inv.size,
        quantity,
        unitsDeducted,
        pricePerShirt,
        totalAmount,
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

    await tx.execute({
      sql: `INSERT INTO movements
              (type, user_id, user_name, reference, size, quantity_moved,
               money_received, payment_method, sale_id, observations, created_at)
             VALUES ('sale', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        session.userId,
        session.name,
        inv.reference,
        inv.size,
        -unitsDeducted,
        amountReceived,
        paymentMethod,
        saleId,
        observations || null,
        createdAt,
      ],
    });

    await tx.commit();

    const result = saleId;

    revalidatePath("/ventas");
    revalidatePath("/inventario");
    revalidatePath("/reportes");
    revalidatePath("/movimientos");
    revalidatePath("/");

    return { success: "Venta registrada correctamente.", saleId: result };
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
