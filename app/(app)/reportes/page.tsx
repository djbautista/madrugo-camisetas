import type { ReactNode } from "react";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import {
  getBestSellers,
  getInventory,
  getLowStock,
  getMoneyByPaymentMethod,
  getOutOfStock,
  getSalesByDay,
  getSalesBySeller,
} from "@/lib/reports";
import { formatCOP, formatDate } from "@/lib/format";
import { requireRole } from "@/lib/session";
import {
  DEFAULT_LOW_STOCK_THRESHOLD,
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from "@/lib/types";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ umbral?: string }>;
}) {
  // Reportes accesibles para Administrador y Consulta.
  await requireRole("admin", "viewer");

  const { umbral } = await searchParams;
  const threshold =
    umbral && Number.isFinite(Number(umbral)) && Number(umbral) > 0
      ? Math.floor(Number(umbral))
      : DEFAULT_LOW_STOCK_THRESHOLD;

  const [
    inventory,
    salesByDay,
    salesBySeller,
    moneyByMethod,
    bestSellers,
    lowStock,
    outOfStock,
  ] = await Promise.all([
    getInventory(),
    getSalesByDay(),
    getSalesBySeller(),
    getMoneyByPaymentMethod(),
    getBestSellers(),
    getLowStock(threshold),
    getOutOfStock(),
  ]);

  const totalUnits = inventory.reduce((acc, i) => acc + i.quantity, 0);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Reportes"
        description="Indicadores calculados a partir de las ventas y movimientos reales."
      />

      {/* Inventario disponible */}
      <Section
        title="Inventario disponible"
        description={`Stock actual por referencia y talla. Total: ${totalUnits} unidad(es).`}
      >
        {inventory.length === 0 ? (
          <EmptyState title="No hay inventario cargado" />
        ) : (
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <Th>Referencia</Th>
                <Th>Talla</Th>
                <Th className="text-right">Disponible</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inventory.map((i) => (
                <tr key={i.id}>
                  <Td className="font-medium text-slate-900">{i.reference}</Td>
                  <Td>{i.size}</Td>
                  <Td className="text-right font-semibold">{i.quantity}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>

      {/* Ventas por día */}
      <Section title="Ventas por día" description="Ingresos y unidades vendidas por día.">
        {salesByDay.length === 0 ? (
          <EmptyState title="Aún no hay ventas" />
        ) : (
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <Th>Día</Th>
                <Th className="text-right">N.º ventas</Th>
                <Th className="text-right">Unidades</Th>
                <Th className="text-right">Ingresos</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {salesByDay.map((d) => (
                <tr key={d.day}>
                  <Td>{formatDate(d.day)}</Td>
                  <Td className="text-right">{d.sales_count}</Td>
                  <Td className="text-right">{d.units}</Td>
                  <Td className="text-right font-semibold">
                    {formatCOP(d.revenue)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>

      {/* Ventas por vendedor */}
      <Section title="Ventas por vendedor" description="Ingresos y unidades por vendedor.">
        {salesBySeller.length === 0 ? (
          <EmptyState title="Aún no hay ventas" />
        ) : (
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <Th>Vendedor</Th>
                <Th className="text-right">N.º ventas</Th>
                <Th className="text-right">Unidades</Th>
                <Th className="text-right">Ingresos</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {salesBySeller.map((s) => (
                <tr key={s.seller_name}>
                  <Td className="font-medium text-slate-900">{s.seller_name}</Td>
                  <Td className="text-right">{s.sales_count}</Td>
                  <Td className="text-right">{s.units}</Td>
                  <Td className="text-right font-semibold">
                    {formatCOP(s.revenue)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>

      {/* Dinero por método de pago */}
      <Section
        title="Dinero recibido por método de pago"
        description="Total recibido agrupado por método de pago."
      >
        {moneyByMethod.length === 0 ? (
          <EmptyState title="Aún no hay ventas" />
        ) : (
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <Th>Método</Th>
                <Th className="text-right">N.º ventas</Th>
                <Th className="text-right">Total recibido</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {moneyByMethod.map((m) => (
                <tr key={m.payment_method}>
                  <Td className="font-medium text-slate-900">
                    {PAYMENT_METHOD_LABELS[
                      m.payment_method as PaymentMethod
                    ] ?? m.payment_method}
                  </Td>
                  <Td className="text-right">{m.sales_count}</Td>
                  <Td className="text-right font-semibold">
                    {formatCOP(m.total_received)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>

      {/* Camisetas más vendidas */}
      <Section
        title="Camisetas más vendidas"
        description="Ordenadas por unidades vendidas."
      >
        {bestSellers.length === 0 ? (
          <EmptyState title="Aún no hay ventas" />
        ) : (
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <Th>Referencia</Th>
                <Th className="text-right">Unidades vendidas</Th>
                <Th className="text-right">Ingresos</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bestSellers.map((b) => (
                <tr key={b.reference}>
                  <Td className="font-medium text-slate-900">{b.reference}</Td>
                  <Td className="text-right font-semibold">{b.units}</Td>
                  <Td className="text-right">{formatCOP(b.revenue)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>

      {/* Stock bajo */}
      <Section
        title="Productos con stock bajo"
        description={`Productos con ${threshold} unidad(es) o menos (y mayor a 0).`}
      >
        {lowStock.length === 0 ? (
          <EmptyState title="No hay productos con stock bajo" />
        ) : (
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <Th>Referencia</Th>
                <Th>Talla</Th>
                <Th className="text-right">Disponible</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lowStock.map((i) => (
                <tr key={i.id}>
                  <Td className="font-medium text-slate-900">{i.reference}</Td>
                  <Td>{i.size}</Td>
                  <Td className="text-right font-semibold">{i.quantity}</Td>
                  <Td>
                    <Badge color="amber">Stock bajo</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>

      {/* Agotados */}
      <Section
        title="Productos agotados"
        description="Productos con cantidad disponible en cero."
      >
        {outOfStock.length === 0 ? (
          <EmptyState title="No hay productos agotados" />
        ) : (
          <Card className="p-4">
            <div className="flex flex-wrap gap-2">
              {outOfStock.map((i) => (
                <Badge key={i.id} color="red">
                  {i.reference} · {i.size}
                </Badge>
              ))}
            </div>
          </Card>
        )}
      </Section>
    </div>
  );
}
