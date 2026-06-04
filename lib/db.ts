import "server-only";
import { createClient, type Client } from "@libsql/client";
import { hashPassword } from "./auth";

// Cliente libSQL (Turso). En local usa un archivo SQLite; en producción
// (Vercel) se conecta a Turso por HTTP mediante variables de entorno.
//   TURSO_DATABASE_URL  -> p.ej. libsql://tu-base.turso.io   (o file:data/madrugo.db en local)
//   TURSO_AUTH_TOKEN    -> token de Turso (no necesario para file:)
//
// El esquema es idéntico a SQLite. Todas las llamadas son asíncronas.

const globalForDb = globalThis as unknown as {
  __madrugoClient?: Client;
  __madrugoInit?: Promise<void>;
};

function makeClient(): Client {
  const url = process.env.TURSO_DATABASE_URL ?? "file:data/madrugo.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  return createClient({ url, authToken, intMode: "number" });
}

function client(): Client {
  if (!globalForDb.__madrugoClient) {
    globalForDb.__madrugoClient = makeClient();
  }
  return globalForDb.__madrugoClient;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
     id            INTEGER PRIMARY KEY AUTOINCREMENT,
     username      TEXT NOT NULL UNIQUE,
     password_hash TEXT NOT NULL,
     salt          TEXT NOT NULL,
     name          TEXT NOT NULL,
     role          TEXT NOT NULL CHECK (role IN ('admin','seller','viewer')),
     created_at    TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS inventory (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     reference   TEXT NOT NULL,
     size        TEXT NOT NULL,
     quantity    INTEGER NOT NULL CHECK (quantity >= 0),
     unit_price  REAL NOT NULL,
     dozen_price REAL,
     updated_at  TEXT NOT NULL,
     UNIQUE (reference, size)
   )`,
  `CREATE TABLE IF NOT EXISTS sales (
     id              INTEGER PRIMARY KEY AUTOINCREMENT,
     sale_type       TEXT NOT NULL CHECK (sale_type IN ('unit','dozen')),
     reference       TEXT NOT NULL,
     size            TEXT NOT NULL,
     quantity        INTEGER NOT NULL,
     units_deducted  INTEGER NOT NULL,
     price_per_shirt REAL NOT NULL,
     total_amount    REAL NOT NULL,
     amount_received REAL NOT NULL,
     seller_id       INTEGER NOT NULL,
     seller_name     TEXT NOT NULL,
     customer_name   TEXT NOT NULL,
     payment_method  TEXT NOT NULL,
     observations    TEXT,
     created_at      TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS movements (
     id             INTEGER PRIMARY KEY AUTOINCREMENT,
     type           TEXT NOT NULL CHECK (type IN ('import','sale','correction','adjustment')),
     user_id        INTEGER NOT NULL,
     user_name      TEXT NOT NULL,
     reference      TEXT NOT NULL,
     size           TEXT NOT NULL,
     quantity_moved INTEGER NOT NULL,
     money_received REAL,
     payment_method TEXT,
     sale_id        INTEGER,
     observations   TEXT,
     created_at     TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS imports (
     id            INTEGER PRIMARY KEY AUTOINCREMENT,
     user_id       INTEGER NOT NULL,
     user_name     TEXT NOT NULL,
     filename      TEXT NOT NULL,
     mode          TEXT NOT NULL,
     rows_total    INTEGER NOT NULL,
     rows_imported INTEGER NOT NULL,
     rows_failed   INTEGER NOT NULL,
     created_at    TEXT NOT NULL
   )`,
];

async function init(): Promise<void> {
  const db = client();
  // Crear esquema (idempotente).
  await db.batch(SCHEMA, "write");

  // Semilla de usuarios (solo si no hay). ON CONFLICT evita choques si dos
  // instancias arrancan a la vez en producción.
  const userCount = await db.execute("SELECT COUNT(*) AS n FROM users");
  if (Number(userCount.rows[0].n) === 0) {
    const now = nowISO();
    const users: [string, string, string, "admin" | "seller" | "viewer"][] = [
      ["admin", "admin123", "Administrador", "admin"],
      ["vendedor", "venta123", "Vendedor de Mostrador", "seller"],
      ["consulta", "ver123", "Usuario de Consulta", "viewer"],
    ];
    await db.batch(
      users.map(([username, password, name, role]) => {
        const { hash, salt } = hashPassword(password);
        return {
          sql: `INSERT INTO users (username, password_hash, salt, name, role, created_at)
                VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(username) DO NOTHING`,
          args: [username, hash, salt, name, role, now],
        };
      }),
      "write",
    );
  }

  // Semilla de inventario de ejemplo (solo si está vacío).
  const invCount = await db.execute("SELECT COUNT(*) AS n FROM inventory");
  if (Number(invCount.rows[0].n) === 0) {
    const now = nowISO();
    const samples: [string, string, number, number, number | null][] = [
      ["Real Madrid Local", "S", 18, 45000, 480000],
      ["Real Madrid Local", "M", 24, 45000, 480000],
      ["Real Madrid Local", "L", 10, 45000, 480000],
      ["Barcelona Visitante", "M", 30, 45000, 480000],
      ["Barcelona Visitante", "L", 8, 45000, 480000],
      ["Selección Colombia", "M", 40, 50000, 540000],
      ["Selección Colombia", "L", 6, 50000, 540000],
      ["Nacional Retro", "M", 0, 38000, null],
    ];
    await db.batch(
      samples.map(([reference, size, qty, unit, dozen]) => ({
        sql: `INSERT INTO inventory (reference, size, quantity, unit_price, dozen_price, updated_at)
              VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(reference, size) DO NOTHING`,
        args: [reference, size, qty, unit, dozen, now],
      })),
      "write",
    );
  }
}

// Garantiza que el esquema y la semilla existan (memoizado por instancia).
function ensureDb(): Promise<void> {
  if (!globalForDb.__madrugoInit) {
    globalForDb.__madrugoInit = init().catch((err) => {
      // Si falla, permitir reintento en la siguiente llamada.
      globalForDb.__madrugoInit = undefined;
      throw err;
    });
  }
  return globalForDb.__madrugoInit;
}

// Devuelve el cliente listo para usar (esquema + semilla garantizados).
export async function getDb(): Promise<Client> {
  await ensureDb();
  return client();
}

export function nowISO(): string {
  return new Date().toISOString();
}
