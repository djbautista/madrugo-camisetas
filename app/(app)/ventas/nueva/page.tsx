import SaleForm, { type SaleItem } from "@/components/SaleForm";
import { EmptyState, PageHeader } from "@/components/ui";
import {
  getConsignees,
  getConsigneePricedHoldings,
  getInventory,
} from "@/lib/reports";
import { requireRole } from "@/lib/session";

export default async function NewSalePage({
  searchParams,
}: {
  searchParams: Promise<{ consignatarioId?: string }>;
}) {
  // Solo Administrador y Vendedor pueden registrar ventas.
  await requireRole("admin", "seller");

  const { consignatarioId } = await searchParams;

  const [inventory, consignees] = await Promise.all([
    getInventory(),
    getConsignees(),
  ]);

  // Solo productos con stock disponible en el almacén.
  const warehouseItems: SaleItem[] = inventory
    .filter((i) => i.quantity > 0)
    .map((i) => ({
      id: i.id,
      reference: i.reference,
      size: i.size,
      quantity: i.quantity,
      unit_price: i.unit_price,
      dozen_price: i.dozen_price,
    }));

  // Solo consignatarios activos pueden elegirse en el desplegable.
  const activeConsignees = consignees
    .filter((c) => c.active === 1)
    .map((c) => ({ id: c.id, name: c.name }));

  // Existencias vendibles (con precio del catálogo) por consignatario activo.
  const holdingsLists = await Promise.all(
    activeConsignees.map((c) => getConsigneePricedHoldings(c.id)),
  );
  const consigneeItems: Record<number, SaleItem[]> = {};
  activeConsignees.forEach((c, idx) => {
    consigneeItems[c.id] = holdingsLists[idx];
  });

  // Si se llegó desde la tarjeta de un consignatario, queda fijado. Solo es
  // válido si está activo y tiene productos vendibles; si no, se ignora y se
  // muestra el desplegable normal (sin notFound).
  const lockedId = Number(consignatarioId);
  const lockedConsignee =
    consignatarioId &&
    !Number.isNaN(lockedId) &&
    (consigneeItems[lockedId]?.length ?? 0) > 0
      ? activeConsignees.find((c) => c.id === lockedId)
      : undefined;

  // Hay algo que vender si el almacén tiene stock o (en modo fijo) el
  // consignatario fijado tiene productos vendibles.
  const hasSomethingToSell = lockedConsignee
    ? (consigneeItems[lockedConsignee.id]?.length ?? 0) > 0
    : warehouseItems.length > 0;

  return (
    <div>
      <PageHeader
        title="Nueva venta"
        description={
          lockedConsignee
            ? `Vende desde el stock en consignación de ${lockedConsignee.name}.`
            : "Registra una venta por unidad o por docena."
        }
      />

      {!hasSomethingToSell ? (
        <EmptyState
          title={
            lockedConsignee
              ? "Este consignatario no tiene productos para vender"
              : "No hay productos con stock disponible"
          }
          description={
            lockedConsignee
              ? "No tiene existencias con precio en el catálogo."
              : "No es posible registrar ventas hasta que haya inventario."
          }
        />
      ) : (
        <SaleForm
          warehouseItems={warehouseItems}
          consignees={activeConsignees}
          consigneeItems={consigneeItems}
          lockedConsignee={lockedConsignee}
        />
      )}
    </div>
  );
}
