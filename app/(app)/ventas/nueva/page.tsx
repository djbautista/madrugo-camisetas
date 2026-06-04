import SaleForm from "@/components/SaleForm";
import { EmptyState, PageHeader } from "@/components/ui";
import { getInventory } from "@/lib/reports";
import { requireRole } from "@/lib/session";

export default async function NewSalePage() {
  // Solo Administrador y Vendedor pueden registrar ventas.
  await requireRole("admin", "seller");

  // Solo productos con stock disponible.
  const items = (await getInventory()).filter((i) => i.quantity > 0);

  return (
    <div>
      <PageHeader
        title="Nueva venta"
        description="Registra una venta por unidad o por docena."
      />

      {items.length === 0 ? (
        <EmptyState
          title="No hay productos con stock disponible"
          description="No es posible registrar ventas hasta que haya inventario."
        />
      ) : (
        <SaleForm
          items={items.map((i) => ({
            id: i.id,
            reference: i.reference,
            size: i.size,
            quantity: i.quantity,
            unit_price: i.unit_price,
            dozen_price: i.dozen_price,
          }))}
        />
      )}
    </div>
  );
}
