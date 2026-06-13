import Link from "next/link";
import { notFound } from "next/navigation";
import { editSale } from "@/app/actions/sales";
import SaleForm, {
  type CartLine,
  type SaleItem,
} from "@/components/SaleForm";
import { EmptyState, PageHeader } from "@/components/ui";
import { getDb } from "@/lib/db";
import { getInventory } from "@/lib/reports";
import { requireRole } from "@/lib/session";
import type { SaleHeaderRow, SaleItemRow } from "@/lib/types";

// Clave compuesta referencia+talla, igual criterio que el resto del código.
const KEY_SEP = " ";
const key = (reference: string, size: string) =>
  `${reference}${KEY_SEP}${size}`;

export default async function EditSalePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Solo el administrador puede editar ventas.
  await requireRole("admin");

  const { id } = await params;
  const saleId = Number(id);
  if (!saleId || Number.isNaN(saleId)) notFound();

  const db = await getDb();
  const headRes = await db.execute({
    sql: "SELECT * FROM sales WHERE id = ?",
    args: [saleId],
  });
  const sale = headRes.rows[0] as unknown as SaleHeaderRow | undefined;
  if (!sale) notFound();

  const itemsRes = await db.execute({
    sql: "SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id",
    args: [saleId],
  });
  const saleItems = itemsRes.rows as unknown as SaleItemRow[];

  const hasConsignee = sale.consignee_id != null;
  const consigneeId = sale.consignee_id as number | null;

  // Unidades que ESTA venta descontó del stock, por producto. La disponibilidad
  // editable es el stock actual + lo que la venta ya había descontado (porque al
  // guardar se revierte por delta neto).
  const deductedByKey = new Map<string, number>();
  for (const it of saleItems) {
    const k = key(it.reference, it.size);
    deductedByKey.set(k, (deductedByKey.get(k) ?? 0) + it.units_deducted);
  }

  // Catálogo de productos para el formulario (con disponibilidad ajustada) y
  // mapa por clave para resolver el inventoryId de cada línea original.
  const inventory = await getInventory();
  const priceByKey = new Map(inventory.map((i) => [key(i.reference, i.size), i]));

  let catalog: SaleItem[];
  if (hasConsignee) {
    // Venta de consignatario: disponibilidad = lo que el consignatario conserva
    // (incluye filas en 0) + lo que esta venta descontó. El precio/id sale del
    // inventario; si el producto ya no existe en el catálogo, no es vendible.
    const csRes = await db.execute({
      sql: "SELECT reference, size, quantity FROM consignment_stock WHERE consignee_id = ?",
      args: [consigneeId],
    });
    const csRows = csRes.rows as unknown as {
      reference: string;
      size: string;
      quantity: number;
    }[];
    catalog = [];
    for (const r of csRows) {
      const inv = priceByKey.get(key(r.reference, r.size));
      if (!inv) continue;
      const quantity = r.quantity + (deductedByKey.get(key(r.reference, r.size)) ?? 0);
      if (quantity <= 0) continue;
      catalog.push({
        id: inv.id,
        reference: r.reference,
        size: r.size,
        quantity,
        unit_price: inv.unit_price,
        dozen_price: inv.dozen_price,
      });
    }
  } else {
    // Venta del almacén: disponibilidad = stock actual + lo que esta venta
    // descontó. Se incluyen también productos en stock para poder añadirlos.
    catalog = inventory
      .map((i) => ({
        id: i.id,
        reference: i.reference,
        size: i.size,
        quantity: i.quantity + (deductedByKey.get(key(i.reference, i.size)) ?? 0),
        unit_price: i.unit_price,
        dozen_price: i.dozen_price,
      }))
      .filter((i) => i.quantity > 0);
  }

  const catalogByKey = new Map(catalog.map((c) => [key(c.reference, c.size), c]));

  // Líneas originales como carrito inicial. Si algún producto ya no existe en el
  // catálogo (eliminado / sin precio), no se puede editar la venta de forma
  // segura: se avisa y no se muestra el formulario.
  const missing: string[] = [];
  const initialCart: CartLine[] = [];
  for (const it of saleItems) {
    const match = catalogByKey.get(key(it.reference, it.size));
    if (!match) {
      missing.push(`${it.reference} · ${it.size}`);
      continue;
    }
    initialCart.push({
      inventoryId: match.id,
      reference: it.reference,
      size: it.size,
      saleType: it.sale_type,
      quantity: it.quantity,
    });
  }

  const backLink = (
    <Link
      href="/ventas"
      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
    >
      Volver
    </Link>
  );

  if (missing.length > 0) {
    return (
      <div>
        <PageHeader title="Editar venta" action={backLink} />
        <EmptyState
          title="Esta venta no se puede editar"
          description={`Uno o más productos ya no existen en el catálogo: ${missing.join(
            ", ",
          )}. Para corregirla, registra una devolución o un ajuste de inventario.`}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Editar venta"
        description={
          hasConsignee
            ? `Venta desde el stock en consignación de ${sale.consignee_name}. El origen no se puede cambiar.`
            : "Edita los productos, el cliente, el pago o el monto. El stock se reajusta automáticamente."
        }
        action={backLink}
      />

      <SaleForm
        action={editSale}
        mode="edit"
        saleId={saleId}
        warehouseItems={hasConsignee ? [] : catalog}
        consignees={[]}
        consigneeItems={hasConsignee ? { [consigneeId as number]: catalog } : {}}
        lockedConsignee={
          hasConsignee
            ? { id: consigneeId as number, name: sale.consignee_name as string }
            : undefined
        }
        initialCart={initialCart}
        initialCustomerName={sale.customer_name}
        initialPaymentMethod={sale.payment_method}
        initialAmountReceived={sale.amount_received}
        initialObservations={sale.observations ?? undefined}
      />
    </div>
  );
}
