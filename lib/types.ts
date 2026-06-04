// Tipos y constantes compartidas del dominio.

export type Role = "admin" | "seller" | "viewer";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  seller: "Vendedor",
  viewer: "Consulta",
};

export type SaleType = "unit" | "dozen";

export const SALE_TYPE_LABELS: Record<SaleType, string> = {
  unit: "Unidad",
  dozen: "Docena",
};

export type PaymentMethod =
  | "efectivo"
  | "nequi"
  | "daviplata"
  | "transferencia"
  | "otro";

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "nequi", label: "Nequi" },
  { value: "daviplata", label: "Daviplata" },
  { value: "transferencia", label: "Transferencia bancaria" },
  { value: "otro", label: "Otro" },
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> =
  Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.label])) as Record<
    PaymentMethod,
    string
  >;

export type MovementType = "import" | "sale" | "correction" | "adjustment";

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  import: "Importación",
  sale: "Venta",
  correction: "Corrección",
  adjustment: "Ajuste",
};

export type ImportMode = "replace" | "merge";

export const IMPORT_MODE_LABELS: Record<ImportMode, string> = {
  replace: "Reemplazar inventario",
  merge: "Sumar / fusionar",
};

// Umbral por defecto para el reporte de stock bajo (configurable vía ?umbral=).
export const DEFAULT_LOW_STOCK_THRESHOLD = 12;

// Unidades por docena.
export const UNITS_PER_DOZEN = 12;

// --- Filas de la base de datos ---

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  salt: string;
  name: string;
  role: Role;
  created_at: string;
}

export interface InventoryRow {
  id: number;
  reference: string;
  size: string;
  quantity: number;
  unit_price: number;
  dozen_price: number | null;
  updated_at: string;
}

export interface SaleRow {
  id: number;
  sale_type: SaleType;
  reference: string;
  size: string;
  quantity: number;
  units_deducted: number;
  price_per_shirt: number;
  total_amount: number;
  amount_received: number;
  seller_id: number;
  seller_name: string;
  customer_name: string;
  payment_method: PaymentMethod;
  observations: string | null;
  created_at: string;
}

export interface MovementRow {
  id: number;
  type: MovementType;
  user_id: number;
  user_name: string;
  reference: string;
  size: string;
  quantity_moved: number;
  money_received: number | null;
  payment_method: PaymentMethod | null;
  sale_id: number | null;
  observations: string | null;
  created_at: string;
}

export interface ImportRow {
  id: number;
  user_id: number;
  user_name: string;
  filename: string;
  mode: ImportMode;
  rows_total: number;
  rows_imported: number;
  rows_failed: number;
  created_at: string;
}
