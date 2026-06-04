import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Role } from "./types";

// Sesión firmada con HMAC, guardada en una cookie httpOnly.
// La firma evita que el cliente altere su rol o identidad.

const COOKIE_NAME = "madrugo_session";
const SECRET =
  process.env.SESSION_SECRET ?? "madrugo-dev-secret-cambiar-en-produccion";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 días

export interface Session {
  userId: number;
  role: Role;
  name: string;
  username: string;
}

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

function encode(session: Session): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(token: string): Session | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Session;
  } catch {
    return null;
  }
}

export async function createSessionCookie(session: Session): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, encode(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return decode(token);
}

// Exige sesión válida; redirige a /login si no hay.
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

// Exige uno de los roles indicados; redirige si no cumple.
export async function requireRole(...roles: Role[]): Promise<Session> {
  const session = await requireSession();
  if (!roles.includes(session.role)) {
    redirect("/?error=permiso");
  }
  return session;
}
