import * as XLSX from "xlsx";
import { requireSession } from "@/lib/session";

// Genera y descarga una plantilla XLSX de ejemplo con los encabezados esperados.
export async function GET() {
  await requireSession();

  const rows = [
    {
      reference: "Real Madrid Local",
      size: "M",
      quantity: 24,
      unit_price: 45000,
      dozen_price: 480000,
    },
    {
      reference: "Selección Colombia",
      size: "L",
      quantity: 12,
      unit_price: 50000,
      dozen_price: 540000,
    },
    {
      reference: "Nacional Retro",
      size: "S",
      quantity: 8,
      unit_price: 38000,
      dozen_price: "",
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: ["reference", "size", "quantity", "unit_price", "dozen_price"],
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "inventario");

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="plantilla-inventario.xlsx"',
    },
  });
}
