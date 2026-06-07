import InventoryAdjustForm from "@/components/InventoryAdjustForm";
import {
  Badge,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { getInventory } from "@/lib/reports";
import { formatCOP } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { DEFAULT_LOW_STOCK_THRESHOLD } from "@/lib/types";

function StockBadge({ quantity }: { quantity: number }) {
  if (quantity === 0) return <Badge color="red">Agotado</Badge>;
  if (quantity <= DEFAULT_LOW_STOCK_THRESHOLD)
    return <Badge color="amber">Stock bajo</Badge>;
  return <Badge color="green">Disponible</Badge>;
}

export default async function InventoryPage() {
  const session = await requireSession();
  const inventory = await getInventory();
  const isAdmin = session.role === "admin";

  return (
    <div>
      <PageHeader
        title="Inventario"
        description="Stock disponible en tiempo real por referencia y talla."
      />

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
