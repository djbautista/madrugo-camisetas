import ImportForm from "@/components/ImportForm";
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/session";

export default async function ImportPage() {
  // Solo administradores pueden importar inventario.
  await requireRole("admin");

  return (
    <div>
      <PageHeader
        title="Importar inventario"
        description="Carga el inventario inicial desde un archivo XLSX."
      />
      <ImportForm />
    </div>
  );
}
