import CreateUserForm from "@/components/CreateUserForm";
import UsersList, { type ManagedUser } from "@/components/UsersList";
import { PageHeader } from "@/components/ui";
import { getDb } from "@/lib/db";
import { requireRole } from "@/lib/session";

export default async function UsuariosPage() {
  // Solo administradores pueden gestionar usuarios.
  const session = await requireRole("admin");

  const db = await getDb();
  const res = await db.execute(
    "SELECT id, username, name, role, created_at FROM users ORDER BY created_at ASC, id ASC",
  );
  const users = res.rows as unknown as ManagedUser[];

  return (
    <div>
      <PageHeader
        title="Usuarios"
        description="Crea cuentas para tu equipo, asigna roles, restablece contraseñas o elimina usuarios."
      />

      <CreateUserForm />

      <h2 className="mb-3 text-lg font-semibold text-slate-900">
        Usuarios existentes
      </h2>
      <UsersList users={users} currentUserId={session.userId} />
    </div>
  );
}
