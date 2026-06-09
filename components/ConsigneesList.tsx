"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  setConsigneeActive,
  type ConsigneeActionState,
} from "@/app/actions/consignees";
import { Badge, Card } from "@/components/ui";
import type { ConsigneeWithHeld } from "@/lib/types";

const initialState: ConsigneeActionState = {};

function ConsigneeRow({ consignee }: { consignee: ConsigneeWithHeld }) {
  const [state, formAction, pending] = useActionState(
    setConsigneeActive,
    initialState,
  );
  const isActive = consignee.active === 1;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={`/consignaciones/${consignee.id}`}
            className="font-semibold text-blue-700 hover:underline"
          >
            {consignee.name}
          </Link>
          {consignee.phone && (
            <p className="text-sm text-slate-500">{consignee.phone}</p>
          )}
          {consignee.notes && (
            <p className="mt-0.5 text-xs text-slate-400">{consignee.notes}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-lg font-bold text-slate-900">
              {consignee.held_units}
            </p>
            <p className="text-xs text-slate-400">en su poder</p>
          </div>
          {isActive ? (
            <Badge color="green">Activo</Badge>
          ) : (
            <Badge color="slate">Inactivo</Badge>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
        {isActive && (
          <Link
            href={`/consignaciones/nueva?consignatarioId=${consignee.id}`}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Entrega
          </Link>
        )}
        <Link
          href={`/consignaciones/${consignee.id}`}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Ver detalle
        </Link>
        <form action={formAction}>
          <input type="hidden" name="consigneeId" value={consignee.id} />
          <input type="hidden" name="active" value={isActive ? "0" : "1"} />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            {isActive ? "Desactivar" : "Activar"}
          </button>
        </form>
        {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      </div>
    </Card>
  );
}

export default function ConsigneesList({
  consignees,
}: {
  consignees: ConsigneeWithHeld[];
}) {
  return (
    <div className="space-y-3">
      {consignees.map((c) => (
        <ConsigneeRow key={c.id} consignee={c} />
      ))}
    </div>
  );
}
