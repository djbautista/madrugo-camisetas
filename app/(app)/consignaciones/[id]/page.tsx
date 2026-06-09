import Link from "next/link";
import { notFound } from "next/navigation";
import ConsignmentReturnForm from "@/components/ConsignmentReturnForm";
import { Badge, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import {
  getConsignee,
  getConsigneeHoldings,
  getConsignmentEvents,
} from "@/lib/reports";
import { formatDateTime } from "@/lib/format";
import { requireRole } from "@/lib/session";

export default async function ConsigneeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");

  const { id } = await params;
  const consigneeId = Number(id);
  if (!consigneeId || Number.isNaN(consigneeId)) notFound();

  const consignee = await getConsignee(consigneeId);
  if (!consignee) notFound();

  const [holdings, events] = await Promise.all([
    getConsigneeHoldings(consigneeId),
    getConsignmentEvents(consigneeId),
  ]);

  const totalHeld = holdings.reduce((sum, h) => sum + h.quantity, 0);

  return (
    <div>
      <PageHeader
        title={consignee.name}
        description={
          [consignee.phone, consignee.notes].filter(Boolean).join(" · ") ||
          undefined
        }
        action={
          <div className="flex items-center gap-2">
            {consignee.active === 1 && (
              <Link
                href={`/consignaciones/nueva?consignatarioId=${consignee.id}`}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Entrega
              </Link>
            )}
            <Link
              href="/consignaciones"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Volver
            </Link>
          </div>
        }
      />

      <div className="mb-6 flex items-center gap-3">
        {consignee.active === 1 ? (
          <Badge color="green">Activo</Badge>
        ) : (
          <Badge color="slate">Inactivo</Badge>
        )}
        <span className="text-sm text-slate-500">
          Tiene <span className="font-semibold text-slate-900">{totalHeld}</span>{" "}
          unidad(es) en su poder.
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* En su poder */}
        <div>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">
            En su poder
          </h2>
          {holdings.length === 0 ? (
            <EmptyState title="No tiene productos en consignación" />
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
                {holdings.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50">
                    <Td className="font-medium text-slate-900">{h.reference}</Td>
                    <Td>{h.size}</Td>
                    <Td className="text-right font-semibold">{h.quantity}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>

        {/* Registrar devolución */}
        <div>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">
            Devolver al almacén
          </h2>
          <ConsignmentReturnForm
            consigneeId={consigneeId}
            holdings={holdings.map((h) => ({
              reference: h.reference,
              size: h.size,
              quantity: h.quantity,
            }))}
          />
        </div>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold text-slate-900">
        Historial
      </h2>
      {events.length === 0 ? (
        <EmptyState title="Sin movimientos registrados" />
      ) : (
        <Table>
          <thead className="bg-slate-50">
            <tr>
              <Th>Fecha</Th>
              <Th>Tipo</Th>
              <Th>Productos</Th>
              <Th className="text-right">Unidades</Th>
              <Th>Registró</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {events.map((ev) => (
              <tr key={ev.id} className="hover:bg-slate-50 align-top">
                <Td className="whitespace-nowrap">
                  {formatDateTime(ev.created_at)}
                </Td>
                <Td>
                  {ev.type === "out" ? (
                    <Badge color="blue">Entrega</Badge>
                  ) : (
                    <Badge color="green">Devolución</Badge>
                  )}
                </Td>
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
                <Td className="text-slate-500">{ev.user_name}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
