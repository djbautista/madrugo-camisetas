"use server";

import { revalidatePath } from "next/cache";
import { getDb, nowISO } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { hashPassword } from "@/lib/auth";
import type { Role } from "@/lib/types";

// Gestión de usuarios. Todas las acciones son solo para administradores.

const VALID_ROLES: Role[] = ["admin", "seller", "viewer"];
const MIN_PASSWORD = 6;

export interface UserActionState {
  error?: string;
  success?: string;
}

async function countAdmins(): Promise<number> {
  const db = await getDb();
  const res = await db.execute(
    "SELECT COUNT(*) AS n FROM users WHERE role = 'admin'",
  );
  return Number(res.rows[0].n);
}

export async function createUser(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  await requireRole("admin");

  const name = String(formData.get("name") ?? "").trim();
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const role = String(formData.get("role") ?? "") as Role;
  const password = String(formData.get("password") ?? "");

  if (!name) return { error: "El nombre es obligatorio." };
  if (!username) return { error: "El usuario es obligatorio." };
  if (!/^[a-z0-9_.-]+$/.test(username)) {
    return {
      error:
        "El usuario solo puede tener minúsculas, números, punto, guion y guion bajo.",
    };
  }
  if (!VALID_ROLES.includes(role)) return { error: "Selecciona un rol válido." };
  if (password.length < MIN_PASSWORD) {
    return {
      error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`,
    };
  }

  const db = await getDb();
  const existing = await db.execute({
    sql: "SELECT id FROM users WHERE username = ?",
    args: [username],
  });
  if (existing.rows.length > 0) {
    return { error: "Ya existe un usuario con ese nombre de usuario." };
  }

  const { hash, salt } = hashPassword(password);
  await db.execute({
    sql: `INSERT INTO users (username, password_hash, salt, name, role, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [username, hash, salt, name, role, nowISO()],
  });

  revalidatePath("/usuarios");
  return { success: `Usuario "${username}" creado correctamente.` };
}

export async function resetPassword(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  await requireRole("admin");

  const userId = Number(formData.get("userId"));
  const password = String(formData.get("password") ?? "");

  if (!userId || Number.isNaN(userId)) return { error: "Usuario inválido." };
  if (password.length < MIN_PASSWORD) {
    return {
      error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`,
    };
  }

  const db = await getDb();
  const { hash, salt } = hashPassword(password);
  const res = await db.execute({
    sql: "UPDATE users SET password_hash = ?, salt = ? WHERE id = ?",
    args: [hash, salt, userId],
  });
  if (res.rowsAffected !== 1) return { error: "No se encontró el usuario." };

  revalidatePath("/usuarios");
  return { success: "Contraseña actualizada." };
}

export async function updateUserRole(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const session = await requireRole("admin");

  const userId = Number(formData.get("userId"));
  const role = String(formData.get("role") ?? "") as Role;

  if (!userId || Number.isNaN(userId)) return { error: "Usuario inválido." };
  if (!VALID_ROLES.includes(role)) return { error: "Rol inválido." };
  if (userId === session.userId) {
    return { error: "No puedes cambiar tu propio rol." };
  }

  const db = await getDb();
  const target = (
    await db.execute({
      sql: "SELECT role FROM users WHERE id = ?",
      args: [userId],
    })
  ).rows[0] as unknown as { role: Role } | undefined;
  if (!target) return { error: "No se encontró el usuario." };

  // No dejar el sistema sin administradores.
  if (target.role === "admin" && role !== "admin" && (await countAdmins()) <= 1) {
    return { error: "Debe quedar al menos un administrador." };
  }

  await db.execute({
    sql: "UPDATE users SET role = ? WHERE id = ?",
    args: [role, userId],
  });

  revalidatePath("/usuarios");
  return { success: "Rol actualizado." };
}

export async function deleteUser(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const session = await requireRole("admin");

  const userId = Number(formData.get("userId"));
  if (!userId || Number.isNaN(userId)) return { error: "Usuario inválido." };
  if (userId === session.userId) {
    return { error: "No puedes eliminar tu propia cuenta." };
  }

  const db = await getDb();
  const target = (
    await db.execute({
      sql: "SELECT role FROM users WHERE id = ?",
      args: [userId],
    })
  ).rows[0] as unknown as { role: Role } | undefined;
  if (!target) return { error: "No se encontró el usuario." };

  if (target.role === "admin" && (await countAdmins()) <= 1) {
    return { error: "Debe quedar al menos un administrador." };
  }

  await db.execute({ sql: "DELETE FROM users WHERE id = ?", args: [userId] });

  revalidatePath("/usuarios");
  return { success: "Usuario eliminado." };
}
