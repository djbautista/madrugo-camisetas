import Link from "next/link";
import ConsignmentDeliveryForm from "@/components/ConsignmentDeliveryForm";
import { EmptyState, PageHeader } from "@/components/ui";
import { getConsignees, getInventory } from "@/lib/reports";
import { requireRole } from "@/lib/session";

export default async function NuevaEntregaPage({
  searchParams,
}: {
  searchParams: Promise<{ consignatarioId?: string }>;
}) {
  await requireRole("admin");

  const { consignatarioId } = await searchParams;

  const [inventory, consignees] = await Promise.all([
    getInventory(),
    getConsignees(),
  ]);

  // Solo se puede entregar lo que hay disponible en el almacén.
  const items = inventory
    .filter((i) => i.quantity > 0)
    .map((i) => ({
      id: i.id,
      reference: i.reference,
      size: i.size,
      quantity: i.quantity,
    }));

  // Solo consignatarios activos pueden recibir stock.
  const activeConsignees = consignees
    .filter((c) => c.active === 1)
    .map((c) => ({ id: c.id, name: c.name }));

  // Si se llegó desde la tarjeta de un consignatario, queda fijado (sin
  // desplegable). Si el id no es válido o está inactivo, se ignora y se muestra
  // el desplegable normal.
  const lockedId = Number(consignatarioId);
  const lockedConsignee =
    consignatarioId && !Number.isNaN(lockedId)
      ? activeConsignees.find((c) => c.id === lockedId)
      : undefined;

  return (
    <div>
      <PageHeader
        title="Nueva entrega en consignación"
        description={
          lockedConsignee
            ? `Selecciona los productos que se lleva ${lockedConsignee.name}.`
            : "Selecciona productos del almacén y el consignatario que se los lleva."
        }
        action={
          <Link
            href="/consignaciones"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Volver
          </Link>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          title="No hay stock disponible para entregar"
          description="El almacén no tiene unidades disponibles en este momento."
        />
      ) : (
        <ConsignmentDeliveryForm
          items={items}
          consignees={activeConsignees}
          lockedConsignee={lockedConsignee}
        />
      )}
    </div>
  );
}
