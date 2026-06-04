"use client";

import { useActionState, useEffect, useRef } from "react";
import { createUser, type UserActionState } from "@/app/actions/users";
import { Card, FieldError, SuccessMessage } from "@/components/ui";
import { ROLE_LABELS, type Role } from "@/lib/types";

const initialState: UserActionState = {};
const ROLES = Object.keys(ROLE_LABELS) as Role[];

export default function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUser, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Limpiar el formulario tras crear un usuario.
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <Card className="mb-8 p-5">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">
        Crear usuario
      </h2>
      <form ref={formRef} action={formAction} className="space-y-4">
        <FieldError message={state.error} />
        <SuccessMessage message={state.success} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="name" className="text-sm font-medium text-slate-700">
              Nombre completo
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="username"
              className="text-sm font-medium text-slate-700"
            >
              Usuario
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoCapitalize="none"
              required
              placeholder="ej: juan.perez"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="role" className="text-sm font-medium text-slate-700">
              Rol
            </label>
            <select
              id="role"
              name="role"
              defaultValue=""
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Selecciona…
              </option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="password"
              className="text-sm font-medium text-slate-700"
            >
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="text"
              required
              minLength={6}
              placeholder="mínimo 6 caracteres"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Creando…" : "Crear usuario"}
        </button>
      </form>
    </Card>
  );
}
