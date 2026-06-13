"use server";

import { revalidatePath } from "next/cache";
import { getDb, nowISO } from "@/lib/db";
import { requireRole } from "@/lib/session";

export interface ExpenseState {
  error?: string;
  success?: string;
  expenseId?: number;
}

export async function createExpense(
  _prevState: ExpenseState,
  formData: FormData,
): Promise<ExpenseState> {
  // Solo el Administrador puede registrar gastos.
  const session = await requireRole("admin");

  const concept = String(formData.get("concept") ?? "").trim();
  const amount = Number(formData.get("amount"));

  // --- Validaciones ---
  if (!concept) {
    return { error: "Escribe el concepto del gasto." };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "El valor del gasto debe ser mayor que cero." };
  }

  try {
    const db = await getDb();
    const res = await db.execute({
      sql: `INSERT INTO expenses
              (concept, amount, user_id, user_name, created_at)
             VALUES (?, ?, ?, ?, ?)`,
      args: [concept, amount, session.userId, session.name, nowISO()],
    });

    revalidatePath("/gastos");

    return {
      success: "Gasto registrado correctamente.",
      expenseId: Number(res.lastInsertRowid),
    };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Ocurrió un error al registrar el gasto.",
    };
  }
}
