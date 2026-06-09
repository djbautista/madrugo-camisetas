"use server";

import { revalidatePath } from "next/cache";
import { getDb, nowISO } from "@/lib/db";
import { requireRole } from "@/lib/session";

// Gestión de consignatarios (personas que se llevan stock en consignación).
// Todas las acciones son solo para administradores. No hay borrado físico: la
// baja es lógica (active = 0) para no romper existencias ni historial.

export interface ConsigneeActionState {
  error?: string;
  success?: string;
  consigneeId?: number; // id del consignatario recién creado (para la UI)
}

export async function createConsignee(
  _prev: ConsigneeActionState,
  formData: FormData,
): Promise<ConsigneeActionState> {
  await requireRole("admin");

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) return { error: "El nombre es obligatorio." };

  const db = await getDb();
  const res = await db.execute({
    sql: `INSERT INTO consignees (name, phone, notes, active, created_at)
          VALUES (?, ?, ?, 1, ?)`,
    args: [name, phone || null, notes || null, nowISO()],
  });

  revalidatePath("/consignaciones");
  return {
    success: `Consignatario "${name}" creado correctamente.`,
    consigneeId: Number(res.lastInsertRowid),
  };
}

export async function updateConsignee(
  _prev: ConsigneeActionState,
  formData: FormData,
): Promise<ConsigneeActionState> {
  await requireRole("admin");

  const consigneeId = Number(formData.get("consigneeId"));
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!consigneeId || Number.isNaN(consigneeId)) {
    return { error: "Consignatario inválido." };
  }
  if (!name) return { error: "El nombre es obligatorio." };

  const db = await getDb();
  const res = await db.execute({
    sql: "UPDATE consignees SET name = ?, phone = ?, notes = ? WHERE id = ?",
    args: [name, phone || null, notes || null, consigneeId],
  });
  if (res.rowsAffected !== 1) return { error: "No se encontró el consignatario." };

  revalidatePath("/consignaciones");
  revalidatePath(`/consignaciones/${consigneeId}`);
  return { success: "Consignatario actualizado." };
}

// Activa o desactiva un consignatario. La baja lógica solo impide entregarle
// más stock; sus existencias y devoluciones siguen disponibles.
export async function setConsigneeActive(
  _prev: ConsigneeActionState,
  formData: FormData,
): Promise<ConsigneeActionState> {
  await requireRole("admin");

  const consigneeId = Number(formData.get("consigneeId"));
  const active = String(formData.get("active") ?? "") === "1" ? 1 : 0;

  if (!consigneeId || Number.isNaN(consigneeId)) {
    return { error: "Consignatario inválido." };
  }

  const db = await getDb();
  const res = await db.execute({
    sql: "UPDATE consignees SET active = ? WHERE id = ?",
    args: [active, consigneeId],
  });
  if (res.rowsAffected !== 1) return { error: "No se encontró el consignatario." };

  revalidatePath("/consignaciones");
  revalidatePath(`/consignaciones/${consigneeId}`);
  return { success: active === 1 ? "Consignatario activado." : "Consignatario desactivado." };
}
