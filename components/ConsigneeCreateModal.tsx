"use client";

import { useActionState, useEffect, useState } from "react";
import {
  createConsignee,
  type ConsigneeActionState,
} from "@/app/actions/consignees";
import { FieldError } from "@/components/ui";

const initialState: ConsigneeActionState = {};

export default function ConsigneeCreateModal() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createConsignee,
    initialState,
  );

  // Cerrar al crear correctamente (la lista se refresca sola tras el action).
  // Guarda por consigneeId para hacerlo una sola vez, durante el render (el
  // proyecto evita setState dentro de effects). Al cerrarse el modal el form se
  // desmonta, así que no hace falta resetear los campos.
  const [handledId, setHandledId] = useState<number | undefined>(undefined);
  if (state.consigneeId !== undefined && state.consigneeId !== handledId) {
    setHandledId(state.consigneeId);
    if (open) setOpen(false);
  }

  // Cerrar con Escape mientras esté abierto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Crear consignatario
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Crear consignatario"
        >
          <div
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Crear consignatario
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form action={formAction} className="space-y-4">
              <FieldError message={state.error} />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label
                    htmlFor="name"
                    className="text-sm font-medium text-slate-700"
                  >
                    Nombre
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    autoFocus
                    placeholder="ej: Joseph"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="phone"
                    className="text-sm font-medium text-slate-700"
                  >
                    Teléfono (opcional)
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="text"
                    placeholder="ej: 3001234567"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="notes"
                  className="text-sm font-medium text-slate-700"
                >
                  Notas (opcional)
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {pending ? "Creando…" : "Crear consignatario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
