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

export type MovementType =
  | "import"
  | "sale"
  | "correction"
  | "adjustment"
  | "return"
  | "consignment_out"
  | "consignment_in";

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  import: "Importación",
  sale: "Venta",
  correction: "Corrección",
  adjustment: "Ajuste",
  return: "Devolución",
  consignment_out: "Salida a consignación",
  consignment_in: "Regreso de consignación",
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

// Cabecera de una venta: datos a nivel de venta (cliente, pago, recibido,
// vendedor). Una venta tiene N líneas de producto en `sale_items`.
export interface SaleHeaderRow {
  id: number;
  total_amount: number; // suma de los total_amount de sus líneas
  amount_received: number;
  seller_id: number;
  seller_name: string;
  customer_name: string;
  payment_method: PaymentMethod;
  observations: string | null;
  // NULL en ventas del almacén; identifican al consignatario cuando la venta se
  // hizo desde su stock (descontado de consignment_stock, no de inventory).
  consignee_id: number | null;
  consignee_name: string | null;
  created_at: string;
}

// Línea de producto dentro de una venta.
export interface SaleItemRow {
  id: number;
  sale_id: number;
  sale_type: SaleType;
  reference: string;
  size: string;
  quantity: number;
  units_deducted: number;
  price_per_shirt: number;
  total_amount: number;
}

// Cabecera con sus líneas, para listados y detalle.
export interface SaleWithItems extends SaleHeaderRow {
  items: SaleItemRow[];
}

// Cabecera de una devolución: datos a nivel de devolución (cliente, método de
// reembolso, quién la registró). Una devolución tiene N líneas en `return_items`.
export interface ReturnHeaderRow {
  id: number;
  total_refund: number; // suma de los refund_amount de sus líneas
  user_id: number;
  user_name: string;
  customer_name: string | null;
  payment_method: PaymentMethod;
  observations: string | null;
  created_at: string;
}

// Línea de producto dentro de una devolución.
export interface ReturnItemRow {
  id: number;
  return_id: number;
  reference: string;
  size: string;
  quantity: number;
  restocked: number; // 0 | 1 (SQLite no tiene booleanos)
  refund_amount: number; // total de la línea
}

// Cabecera con sus líneas, para listados y detalle.
export interface ReturnWithItems extends ReturnHeaderRow {
  items: ReturnItemRow[];
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

// --- Consignaciones ---

// Tipo de evento de consignación: 'out' = entrega al consignatario (sale del
// almacén), 'in' = regreso al almacén (devolución de lo no vendido).
export type ConsignmentEventType = "out" | "in";

// Consignatario: persona que se lleva stock en consignación. Lista gestionada
// (alta/baja lógica). `active` solo bloquea nuevas entregas; sus existencias y
// devoluciones siguen disponibles aunque esté inactivo.
export interface ConsigneeRow {
  id: number;
  name: string;
  phone: string | null;
  notes: string | null;
  active: number; // 0 | 1 (SQLite no tiene booleanos)
  created_at: string;
}

// Existencias actuales que un consignatario tiene en su poder, por
// referencia+talla. Se mantiene al día con cada entrega/devolución (saldo
// materializado, igual que inventory.quantity).
export interface ConsignmentStockRow {
  id: number;
  consignee_id: number;
  reference: string;
  size: string;
  quantity: number;
  updated_at: string;
}

// Cabecera de un evento de consignación (entrega o devolución). Una cabecera
// tiene N líneas en `consignment_event_items`.
export interface ConsignmentEventRow {
  id: number;
  type: ConsignmentEventType;
  consignee_id: number;
  consignee_name: string;
  user_id: number;
  user_name: string;
  total_units: number;
  observations: string | null;
  created_at: string;
}

// Línea de producto dentro de un evento de consignación.
export interface ConsignmentEventItemRow {
  id: number;
  event_id: number;
  reference: string;
  size: string;
  quantity: number;
}

// Cabecera con sus líneas, para listados y detalle.
export interface ConsignmentEventWithItems extends ConsignmentEventRow {
  items: ConsignmentEventItemRow[];
}

// Fila de inventario con el total que hay en consignación (suma entre todos los
// consignatarios para esa referencia+talla). `quantity` es lo disponible en el
// almacén; el total real del negocio es quantity + consigned.
export interface InventoryWithConsignment extends InventoryRow {
  consigned: number;
}

// Consignatario con el total de unidades que tiene en su poder (para listados).
export interface ConsigneeWithHeld extends ConsigneeRow {
  held_units: number;
}
