"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createExpense, type ExpenseState } from "@/app/actions/expenses";
import { Card, FieldError, SuccessMessage } from "@/components/ui";

const initialState: ExpenseState = {};

// Botón "Registrar gasto" + modal con el formulario. El modal se ancla al
// fondo en móvil y se centra en escritorio (mobile-friendly).
export default function ExpenseForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createExpense,
    initialState,
  );

  // Cerrar el modal tras un gasto exitoso (ajuste de estado durante el render,
  // con guarda por expenseId para hacerlo una sola vez). Al cerrarse el modal
  // el formulario se desmonta, así que queda limpio para el siguiente gasto.
  const [handledId, setHandledId] = useState<number | undefined>(undefined);
  if (state.expenseId !== undefined && state.expenseId !== handledId) {
    setHandledId(state.expenseId);
    setOpen(false);
  }

  // Refrescar la tabla del servidor tras un gasto exitoso.
  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, state.expenseId, router]);

  // Cerrar con la tecla Esc mientras el modal está abierto.
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
        Registrar gasto
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <Card
            className="w-full max-w-md p-5"
            // Evita que un clic dentro del formulario cierre el modal.
          >
            <div onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">
                  Registrar gasto
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar"
                  className="text-2xl leading-none text-slate-400 hover:text-slate-600"
                >
                  ×
                </button>
              </div>

              <form action={formAction} className="space-y-4">
                <FieldError message={state.error} />
                <SuccessMessage message={state.success} />

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">
                    Concepto
                  </label>
                  <input
                    name="concept"
                    type="text"
                    required
                    placeholder="Arriendo, transporte, insumos…"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">
                    Valor
                  </label>
                  <input
                    name="amount"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step="any"
                    required
                    placeholder="0"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={pending}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {pending ? "Registrando…" : "Registrar gasto"}
                </button>
              </form>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
