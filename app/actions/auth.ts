"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { createSessionCookie, destroySessionCookie } from "@/lib/session";
import type { UserRow } from "@/lib/types";

export interface LoginState {
  error?: string;
}

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Ingresa usuario y contraseña." };
  }

  const db = await getDb();
  const res = await db.execute({
    sql: "SELECT * FROM users WHERE username = ?",
    args: [username],
  });
  const user = res.rows[0] as unknown as UserRow | undefined;

  if (!user || !verifyPassword(password, user.password_hash, user.salt)) {
    return { error: "Usuario o contraseña incorrectos." };
  }

  await createSessionCookie({
    userId: user.id,
    role: user.role,
    name: user.name,
    username: user.username,
  });

  redirect("/");
}

export async function logout(): Promise<void> {
  await destroySessionCookie();
  redirect("/login");
}
