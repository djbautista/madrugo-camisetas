"use client";

import { useActionState, useState } from "react";
import {
  deleteUser,
  resetPassword,
  updateUserRole,
  type UserActionState,
} from "@/app/actions/users";
import { Badge, Card } from "@/components/ui";
import { ROLE_LABELS, type Role } from "@/lib/types";

export interface ManagedUser {
  id: number;
  username: string;
  name: string;
  role: Role;
  created_at: string;
}

const ROLES = Object.keys(ROLE_LABELS) as Role[];
const initialState: UserActionState = {};

const ROLE_COLORS: Record<Role, "blue" | "green" | "slate"> = {
  admin: "blue",
  seller: "green",
  viewer: "slate",
};

function Msg({ state }: { state: UserActionState }) {
  if (state.error)
    return <p className="text-xs text-red-600">{state.error}</p>;
  if (state.success)
    return <p className="text-xs text-emerald-600">{state.success}</p>;
  return null;
}

function UserRow({ user, isSelf }: { user: ManagedUser; isSelf: boolean }) {
  const [roleState, roleAction, rolePending] = useActionState(
    updateUserRole,
    initialState,
  );
  const [pwState, pwAction, pwPending] = useActionState(
    resetPassword,
    initialState,
  );
  const [delState, delAction, delPending] = useActionState(
    deleteUser,
    initialState,
  );
  const [showReset, setShowReset] = useState(false);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900">
            {user.name}{" "}
            {isSelf && (
              <span className="text-xs font-normal text-slate-400">(tú)</span>
            )}
          </p>
          <p className="text-sm text-slate-500">@{user.username}</p>
        </div>
        <Badge color={ROLE_COLORS[user.role]}>{ROLE_LABELS[user.role]}</Badge>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
        {/* Rol */}
        <form action={roleAction} className="space-y-1">
          <input type="hidden" name="userId" value={user.id} />
          <label className="text-xs font-medium text-slate-600">Rol</label>
          <div className="flex gap-2">
            <select
              name="role"
              defaultValue={user.role}
              disabled={isSelf}
              className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={isSelf || rolePending}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
          <Msg state={roleState} />
        </form>

        {/* Restablecer contraseña */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">
            Contraseña
          </label>
          {showReset ? (
            <form action={pwAction} className="space-y-1">
              <input type="hidden" name="userId" value={user.id} />
              <div className="flex gap-2">
                <input
                  name="password"
                  type="text"
                  required
                  minLength={6}
                  placeholder="nueva contraseña"
                  className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                />
                <button
                  type="submit"
                  disabled={pwPending}
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
                >
                  Guardar
                </button>
              </div>
              <Msg state={pwState} />
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowReset(true)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Restablecer contraseña
            </button>
          )}
        </div>

        {/* Eliminar */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">
            Eliminar
          </label>
          <form
            action={delAction}
            onSubmit={(e) => {
              if (
                !confirm(
                  `¿Eliminar al usuario "${user.username}"? Esta acción no se puede deshacer.`,
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="userId" value={user.id} />
            <button
              type="submit"
              disabled={isSelf || delPending}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Eliminar usuario
            </button>
            <div className="mt-1">
              <Msg state={delState} />
            </div>
          </form>
        </div>
      </div>
    </Card>
  );
}

export default function UsersList({
  users,
  currentUserId,
}: {
  users: ManagedUser[];
  currentUserId: number;
}) {
  return (
    <div className="space-y-3">
      {users.map((u) => (
        <UserRow key={u.id} user={u} isSelf={u.id === currentUserId} />
      ))}
    </div>
  );
}
