import Link from "next/link";
import InventoryAdjustForm from "@/components/InventoryAdjustForm";
import {
  Badge,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import {
  getConsignmentStockByConsignee,
  getInventory,
  getInventoryWithConsignment,
} from "@/lib/reports";
import { formatCOP } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { DEFAULT_LOW_STOCK_THRESHOLD } from "@/lib/types";

function StockBadge({ quantity }: { quantity: number }) {
  if (quantity === 0) return <Badge color="red">Agotado</Badge>;
  if (quantity <= DEFAULT_LOW_STOCK_THRESHOLD)
    return <Badge color="amber">Stock bajo</Badge>;
  return <Badge color="green">Disponible</Badge>;
}

// Pestaña del toggle de vista (mismo estilo activo/inactivo que la navegación).
function ViewTab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-blue-50 text-blue-700"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {children}
    </Link>
  );
}

// Un grupo de existencias (almacén o un consignatario) en la vista agrupada.
function StockGroup({
  title,
  total,
  items,
}: {
  title: string;
  total: number;
  items: { reference: string; size: string; quantity: number }[];
}) {
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <span className="text-sm text-slate-500">{total} unidad(es)</span>
      </div>
      {items.length === 0 ? (
        <p className="rounded-md bg-slate-50 px-3 py-3 text-sm text-slate-500">
          Sin existencias.
        </p>
      ) : (
        <Table>
          <thead className="bg-slate-50">
            <tr>
              <Th>Referencia</Th>
              <Th>Talla</Th>
              <Th className="text-right">Cantidad</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((it, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <Td className="font-medium text-slate-900">{it.reference}</Td>
                <Td>{it.size}</Td>
                <Td className="text-right font-semibold">{it.quantity}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>;
}) {
  const session = await requireSession();
  const isAdmin = session.role === "admin";
  const grouped = (await searchParams).vista === "consignatario";

  const toggle = (
    <div className="mb-6 inline-flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
      <ViewTab href="/inventario" active={!grouped}>
        Por producto
      </ViewTab>
      <ViewTab href="/inventario?vista=consignatario" active={grouped}>
        Por consignatario
      </ViewTab>
    </div>
  );

  // --- Vista agrupada por consignatario (con el almacén como primer grupo) ---
  if (grouped) {
    const [warehouse, consigneeGroups] = await Promise.all([
      getInventory(),
      getConsignmentStockByConsignee(),
    ]);
    const warehouseItems = warehouse.filter((i) => i.quantity > 0);
    const warehouseTotal = warehouseItems.reduce((s, i) => s + i.quantity, 0);

    return (
      <div>
        <PageHeader
          title="Inventario"
          description="Stock por ubicación: lo disponible en el almacén y lo que tiene cada consignatario."
        />
        {toggle}

        <StockGroup
          title="Almacén"
          total={warehouseTotal}
          items={warehouseItems.map((i) => ({
            reference: i.reference,
            size: i.size,
            quantity: i.quantity,
          }))}
        />

        {consigneeGroups.length === 0 ? (
          <p className="rounded-md bg-slate-50 px-3 py-3 text-sm text-slate-500">
            No hay stock en consignación.
          </p>
        ) : (
          consigneeGroups.map((g) => (
            <StockGroup
              key={g.consignee_id}
              title={g.consignee_name}
              total={g.total}
              items={g.items}
            />
          ))
        )}
      </div>
    );
  }

  // --- Vista por producto (por defecto) ---
  const inventory = await getInventoryWithConsignment();

  return (
    <div>
      <PageHeader
        title="Inventario"
        description="Stock en tiempo real por referencia y talla: disponible en el almacén y en consignación."
      />
      {toggle}

      {isAdmin && inventory.length > 0 && (
        <InventoryAdjustForm
          products={inventory.map((i) => ({
            id: i.id,
            reference: i.reference,
            size: i.size,
            quantity: i.quantity,
          }))}
        />
      )}

      {inventory.length === 0 ? (
        <EmptyState
          title="No hay productos en el inventario"
          description={
            isAdmin
              ? "Importa un archivo XLSX desde la sección Importar para comenzar."
              : "Aún no se ha cargado inventario."
          }
        />
      ) : (
        <Table>
          <thead className="bg-slate-50">
            <tr>
              <Th>Referencia</Th>
              <Th>Talla</Th>
              <Th className="text-right">Disponible</Th>
              <Th className="text-right">En consignación</Th>
              <Th className="text-right">Total</Th>
              <Th className="text-right">Precio unidad</Th>
              <Th className="text-right">Precio docena (c/u)</Th>
              <Th>Estado</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {inventory.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <Td className="font-medium text-slate-900">{item.reference}</Td>
                <Td>{item.size}</Td>
                <Td className="text-right font-semibold">{item.quantity}</Td>
                <Td className="text-right text-slate-500">
                  {item.consigned > 0 ? item.consigned : "—"}
                </Td>
                <Td className="text-right font-medium">
                  {item.quantity + item.consigned}
                </Td>
                <Td className="text-right">{formatCOP(item.unit_price)}</Td>
                <Td className="text-right">{formatCOP(item.dozen_price)}</Td>
                <Td>
                  <StockBadge quantity={item.quantity} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
