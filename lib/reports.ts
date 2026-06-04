import "server-only";
import { getDb } from "./db";
import type { InventoryRow } from "./types";

// Consultas agregadas para los reportes. Todo se calcula desde
// los datos reales de inventario, ventas y movimientos.

export interface SalesByDay {
  day: string; // YYYY-MM-DD
  revenue: number;
  units: number;
  sales_count: number;
}

export interface SalesBySeller {
  seller_name: string;
  revenue: number;
  units: number;
  sales_count: number;
}

export interface MoneyByPaymentMethod {
  payment_method: string;
  total_received: number;
  sales_count: number;
}

export interface BestSeller {
  reference: string;
  units: number;
  revenue: number;
}

export async function getInventory(): Promise<InventoryRow[]> {
  const db = await getDb();
  const res = await db.execute(
    `SELECT * FROM inventory ORDER BY reference COLLATE NOCASE, size COLLATE NOCASE`,
  );
  return res.rows as unknown as InventoryRow[];
}

export async function getSalesByDay(): Promise<SalesByDay[]> {
  const db = await getDb();
  const res = await db.execute(
    `SELECT date(created_at) AS day,
            SUM(total_amount)   AS revenue,
            SUM(units_deducted) AS units,
            COUNT(*)            AS sales_count
     FROM sales
     GROUP BY date(created_at)
     ORDER BY day DESC`,
  );
  return res.rows as unknown as SalesByDay[];
}

export async function getSalesBySeller(): Promise<SalesBySeller[]> {
  const db = await getDb();
  const res = await db.execute(
    `SELECT seller_name,
            SUM(total_amount)   AS revenue,
            SUM(units_deducted) AS units,
            COUNT(*)            AS sales_count
     FROM sales
     GROUP BY seller_id, seller_name
     ORDER BY revenue DESC`,
  );
  return res.rows as unknown as SalesBySeller[];
}

export async function getMoneyByPaymentMethod(): Promise<MoneyByPaymentMethod[]> {
  const db = await getDb();
  const res = await db.execute(
    `SELECT payment_method,
            SUM(amount_received) AS total_received,
            COUNT(*)             AS sales_count
     FROM sales
     GROUP BY payment_method
     ORDER BY total_received DESC`,
  );
  return res.rows as unknown as MoneyByPaymentMethod[];
}

export async function getBestSellers(limit = 10): Promise<BestSeller[]> {
  const db = await getDb();
  const res = await db.execute({
    sql: `SELECT reference,
                 SUM(units_deducted) AS units,
                 SUM(total_amount)   AS revenue
          FROM sales
          GROUP BY reference
          ORDER BY units DESC
          LIMIT ?`,
    args: [limit],
  });
  return res.rows as unknown as BestSeller[];
}

export async function getLowStock(threshold: number): Promise<InventoryRow[]> {
  const db = await getDb();
  const res = await db.execute({
    sql: `SELECT * FROM inventory
          WHERE quantity > 0 AND quantity <= ?
          ORDER BY quantity ASC, reference COLLATE NOCASE`,
    args: [threshold],
  });
  return res.rows as unknown as InventoryRow[];
}

export async function getOutOfStock(): Promise<InventoryRow[]> {
  const db = await getDb();
  const res = await db.execute(
    `SELECT * FROM inventory
     WHERE quantity = 0
     ORDER BY reference COLLATE NOCASE, size COLLATE NOCASE`,
  );
  return res.rows as unknown as InventoryRow[];
}

export interface DashboardStats {
  total_units: number;
  distinct_products: number;
  sales_today_revenue: number;
  sales_today_count: number;
  out_of_stock_count: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const db = await getDb();
  const invRes = await db.execute(
    `SELECT COALESCE(SUM(quantity),0) AS total_units,
            COUNT(*)                  AS distinct_products,
            COALESCE(SUM(CASE WHEN quantity = 0 THEN 1 ELSE 0 END),0) AS out_of_stock_count
     FROM inventory`,
  );
  const inv = invRes.rows[0] as unknown as {
    total_units: number;
    distinct_products: number;
    out_of_stock_count: number;
  };

  const todayRes = await db.execute(
    `SELECT COALESCE(SUM(total_amount),0) AS revenue, COUNT(*) AS cnt
     FROM sales
     WHERE date(created_at) = date('now','localtime')`,
  );
  const today = todayRes.rows[0] as unknown as { revenue: number; cnt: number };

  return {
    total_units: inv.total_units,
    distinct_products: inv.distinct_products,
    out_of_stock_count: inv.out_of_stock_count,
    sales_today_revenue: today.revenue,
    sales_today_count: today.cnt,
  };
}
