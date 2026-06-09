import ConsigneeCreateModal from "@/components/ConsigneeCreateModal";
import ConsigneesList from "@/components/ConsigneesList";
import { Badge, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { getConsignees, getConsignmentEvents } from "@/lib/reports";
import { formatDateTime } from "@/lib/format";
import { requireRole } from "@/lib/session";

export default async function ConsignacionesPage() {
  // Solo administradores gestionan consignaciones.
  await requireRole("admin");

  const [consignees, events] = await Promise.all([
    getConsignees(),
    getConsignmentEvents(),
  ]);
  const recentEvents = events.slice(0, 15);

  return (
    <div>
      <PageHeader
        title="Consignaciones"
        description="Entrega stock en consignación, controla lo que tiene cada persona y recibe devoluciones al almacén."
        action={<ConsigneeCreateModal />}
      />

      <h2 className="mb-3 text-lg font-semibold text-slate-900">
        Consignatarios
      </h2>
      {consignees.length === 0 ? (
        <EmptyState
          title="Aún no hay consignatarios"
          description="Usa el botón «Crear consignatario» para empezar a entregar stock en consignación."
        />
      ) : (
        <ConsigneesList consignees={consignees} />
      )}

      <h2 className="mb-3 mt-8 text-lg font-semibold text-slate-900">
        Movimientos recientes
      </h2>
      {recentEvents.length === 0 ? (
        <EmptyState title="Aún no hay entregas ni devoluciones registradas" />
      ) : (
        <Table>
          <thead className="bg-slate-50">
            <tr>
              <Th>Fecha</Th>
              <Th>Tipo</Th>
              <Th>Consignatario</Th>
              <Th>Productos</Th>
              <Th className="text-right">Unidades</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {recentEvents.map((ev) => (
              <tr key={ev.id} className="hover:bg-slate-50 align-top">
                <Td className="whitespace-nowrap">{formatDateTime(ev.created_at)}</Td>
                <Td>
                  {ev.type === "out" ? (
                    <Badge color="blue">Entrega</Badge>
                  ) : (
                    <Badge color="green">Devolución</Badge>
                  )}
                </Td>
                <Td className="font-medium text-slate-900">{ev.consignee_name}</Td>
                <Td>
                  <ul className="space-y-0.5">
                    {ev.items.map((it) => (
                      <li key={it.id}>
                        {it.reference} · {it.size} ×{it.quantity}
                      </li>
                    ))}
                  </ul>
                </Td>
                <Td className="text-right font-semibold">{ev.total_units}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
