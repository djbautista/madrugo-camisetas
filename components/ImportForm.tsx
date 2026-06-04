"use client";

import { useActionState } from "react";
import {
  importInventory,
  type ImportState,
} from "@/app/actions/inventory";
import { Card, FieldError } from "@/components/ui";
import { IMPORT_MODE_LABELS } from "@/lib/types";

const initialState: ImportState = {};

export default function ImportForm() {
  const [state, formAction, pending] = useActionState(
    importInventory,
    initialState,
  );

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <form action={formAction} className="space-y-5">
          <FieldError message={state.error} />

          <div className="space-y-1">
            <label htmlFor="file" className="text-sm font-medium text-slate-700">
              Archivo XLSX
            </label>
            <input
              id="file"
              name="file"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
              className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700"
            />
            <p className="text-xs text-slate-500">
              Columnas esperadas: <code>reference</code>, <code>size</code>,{" "}
              <code>quantity</code>, <code>unit_price</code>,{" "}
              <code>dozen_price</code> (esta última es opcional).{" "}
              <a
                href="/api/plantilla"
                className="font-medium text-blue-600 hover:underline"
              >
                Descargar plantilla
              </a>
            </p>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-slate-700">
              ¿Qué hacer con el inventario existente?
            </legend>
            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
              <input
                type="radio"
                name="mode"
                value="merge"
                defaultChecked
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium text-slate-800">
                  {IMPORT_MODE_LABELS.merge}
                </span>
                <span className="block text-xs text-slate-500">
                  Suma las cantidades a los productos existentes (por referencia
                  y talla) y crea los nuevos. Actualiza los precios.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
              <input type="radio" name="mode" value="replace" className="mt-1" />
              <span>
                <span className="block text-sm font-medium text-slate-800">
                  {IMPORT_MODE_LABELS.replace}
                </span>
                <span className="block text-xs text-slate-500">
                  Borra todo el inventario actual y lo reemplaza por el contenido
                  del archivo. Esta acción no se puede deshacer.
                </span>
              </span>
            </label>
          </fieldset>

          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {pending ? "Importando…" : "Importar inventario"}
          </button>
        </form>
      </Card>

      {state.success && (
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Resultado de la importación
          </h2>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <span className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700">
              Importadas: <strong>{state.imported}</strong>
            </span>
            <span className="rounded-lg bg-red-50 px-3 py-2 text-red-700">
              Con errores: <strong>{state.failed}</strong>
            </span>
            <span className="rounded-lg bg-slate-100 px-3 py-2 text-slate-700">
              Total de filas: <strong>{state.total}</strong>
            </span>
          </div>

          {state.errors && state.errors.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-slate-700">
                Filas no importadas
              </p>
              <ul className="space-y-1 text-sm">
                {state.errors.map((e) => (
                  <li
                    key={e.row}
                    className="rounded-md bg-red-50 px-3 py-1.5 text-red-700"
                  >
                    Fila {e.row}: {e.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
