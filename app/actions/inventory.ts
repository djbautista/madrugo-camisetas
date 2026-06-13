"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { getDb, nowISO } from "@/lib/db";
import { requireRole } from "@/lib/session";
import type { ImportMode, InventoryRow } from "@/lib/types";

// ----------------------------------------------------------------------------
// Importación de inventario desde XLSX
// ----------------------------------------------------------------------------

export interface ImportRowError {
  row: number; // número de fila en el archivo (1 = encabezado)
  reason: string;
}

export interface ImportState {
  error?: string;
  success?: boolean;
  imported?: number;
  failed?: number;
  total?: number;
  mode?: ImportMode;
  errors?: ImportRowError[];
}

interface ParsedRow {
  reference: string;
  size: string;
  quantity: number;
  unit_price: number;
  dozen_price: number | null;
}

// Busca una clave sin importar mayúsculas/espacios.
function pick(obj: Record<string, unknown>, key: string): unknown {
  const found = Object.keys(obj).find(
    (k) => k.trim().toLowerCase() === key.toLowerCase(),
  );
  return found ? obj[found] : undefined;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

export async function importInventory(
  _prevState: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const session = await requireRole("admin");

  const file = formData.get("file");
  const mode = String(formData.get("mode")) as ImportMode;

  if (mode !== "replace" && mode !== "merge") {
    return { error: "Selecciona el modo de importación." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecciona un archivo XLSX válido." };
  }

  let rawRows: Record<string, unknown>[];
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { error: "El archivo no contiene hojas." };
    }
    rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[sheetName],
      { defval: null },
    );
  } catch {
    return {
      error:
        "No se pudo leer el archivo. Asegúrate de que sea un XLSX válido.",
    };
  }

  if (rawRows.length === 0) {
    return { error: "El archivo no tiene filas de datos." };
  }

  const valid: ParsedRow[] = [];
  const errors: ImportRowError[] = [];

  rawRows.forEach((raw, index) => {
    const fileRow = index + 2; // +1 por encabezado, +1 por base 1

    const reference = String(pick(raw, "reference") ?? "").trim();
    const sizeRaw = pick(raw, "size");
    const size = sizeRaw === null || sizeRaw === undefined ? "" : String(sizeRaw).trim();
    const quantity = parseNumber(pick(raw, "quantity"));
    const unitPrice = parseNumber(pick(raw, "unit_price"));
    const dozenPrice = parseNumber(pick(raw, "dozen_price"));

    const rowErrors: string[] = [];
    if (!reference) rowErrors.push("falta 'reference'");
    if (!size) rowErrors.push("falta 'size'");
    if (quantity === null || !Number.isInteger(quantity) || quantity < 0) {
      rowErrors.push("'quantity' debe ser un entero ≥ 0");
    }
    if (unitPrice === null || unitPrice <= 0) {
      rowErrors.push("'unit_price' debe ser un número mayor a 0");
    }
    if (pick(raw, "dozen_price") != null && pick(raw, "dozen_price") !== "" && (dozenPrice === null || dozenPrice <= 0)) {
      rowErrors.push("'dozen_price' debe ser un número mayor a 0 o estar vacío");
    }

    if (rowErrors.length > 0) {
      errors.push({ row: fileRow, reason: rowErrors.join("; ") });
      return;
    }

    valid.push({
      reference,
      size,
      quantity: quantity as number,
      unit_price: unitPrice as number,
      dozen_price: dozenPrice,
    });
  });

  if (valid.length === 0) {
    return {
      error: "Ninguna fila es válida. Revisa los errores y vuelve a intentar.",
      failed: errors.length,
      total: rawRows.length,
      errors,
      mode,
    };
  }

  const db = await getDb();
  const createdAt = nowISO();

  // Se construye un único lote atómico (batch = transacción): o se aplica
  // todo, o nada.
  const statements: { sql: string; args: (string | number | null)[] }[] = [];

  if (mode === "replace") {
    statements.push({ sql: "DELETE FROM inventory", args: [] });
  }

  const upsertSql = `INSERT INTO inventory (reference, size, quantity, unit_price, dozen_price, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(reference, size) DO UPDATE SET
       quantity    = quantity + excluded.quantity,
       unit_price  = excluded.unit_price,
       dozen_price = excluded.dozen_price,
       updated_at  = excluded.updated_at`;
  const movementSql = `INSERT INTO movements
       (type, user_id, user_name, reference, size, quantity_moved, observations, created_at)
     VALUES ('import', ?, ?, ?, ?, ?, ?, ?)`;
  const movementLabel = `Importación (${mode === "replace" ? "reemplazo" : "fusión"})`;

  for (const r of valid) {
    statements.push({
      sql: upsertSql,
      args: [r.reference, r.size, r.quantity, r.unit_price, r.dozen_price, createdAt],
    });
    statements.push({
      sql: movementSql,
      args: [
        session.userId,
        session.name,
        r.reference,
        r.size,
        r.quantity,
        movementLabel,
        createdAt,
      ],
    });
  }

  statements.push({
    sql: `INSERT INTO imports
       (user_id, user_name, filename, mode, rows_total, rows_imported, rows_failed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      session.userId,
      session.name,
      file.name,
      mode,
      rawRows.length,
      valid.length,
      errors.length,
      createdAt,
    ],
  });

  await db.batch(statements, "write");

  revalidatePath("/inventario");
  revalidatePath("/movimientos");
  revalidatePath("/");

  return {
    success: true,
    imported: valid.length,
    failed: errors.length,
    total: rawRows.length,
    mode,
    errors,
  };
}

// ----------------------------------------------------------------------------
// Ajuste / corrección de inventario (solo Administrador)
// ----------------------------------------------------------------------------

export interface AdjustState {
  error?: string;
  success?: string;
}

export async function adjustInventory(
  _prevState: AdjustState,
  formData: FormData,
): Promise<AdjustState> {
  const session = await requireRole("admin");

  const inventoryId = Number(formData.get("inventoryId"));
  const adjustMode = String(formData.get("adjustMode")); // 'set' | 'delta'
  const value = Number(formData.get("value"));
  const reason = String(formData.get("reason") ?? "").trim();

  if (!inventoryId || Number.isNaN(inventoryId)) {
    return { error: "Producto inválido." };
  }
  if (adjustMode !== "set" && adjustMode !== "delta") {
    return { error: "Selecciona el tipo de ajuste." };
  }
  if (Number.isNaN(value) || !Number.isInteger(value)) {
    return { error: "El valor debe ser un número entero." };
  }
  if (!reason) {
    return { error: "El motivo del ajuste es obligatorio." };
  }

  const db = await getDb();
  const tx = await db.transaction("write");

  try {
    const invRes = await tx.execute({
      sql: "SELECT * FROM inventory WHERE id = ?",
      args: [inventoryId],
    });
    const inv = invRes.rows[0] as unknown as InventoryRow | undefined;
    if (!inv) throw new Error("El producto ya no existe.");

    const newQty = adjustMode === "set" ? value : inv.quantity + value;
    if (newQty < 0) {
      throw new Error(
        `El ajuste dejaría el stock en ${newQty}. No puede ser negativo.`,
      );
    }
    const delta = newQty - inv.quantity;
    const createdAt = nowISO();

    await tx.execute({
      sql: "UPDATE inventory SET quantity = ?, updated_at = ? WHERE id = ?",
      args: [newQty, createdAt, inventoryId],
    });

    await tx.execute({
      sql: `INSERT INTO movements
              (type, user_id, user_name, reference, size, quantity_moved, observations, created_at)
             VALUES ('adjustment', ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        session.userId,
        session.name,
        inv.reference,
        inv.size,
        delta,
        reason,
        createdAt,
      ],
    });

    await tx.commit();
  } catch (err) {
    await tx.rollback();
    return {
      error: err instanceof Error ? err.message : "No se pudo ajustar el stock.",
    };
  }

  revalidatePath("/inventario");
  revalidatePath("/movimientos");

  return { success: "Inventario ajustado correctamente." };
}
