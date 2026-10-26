"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  TrendingUp,
  DollarSign,
  Award,
  AlertCircle,
  Wallet,
  BarChart3,
} from "lucide-react";

interface AnalyticsData {
  kpis: {
    ventas_hoy: number;
    ganancia_hoy: number;
    ventas_mes: number;
    ganancia_mes: number;
    productos_stock_bajo: number;
    total_fiados: number;
  };
  serie_7_dias: {
    fecha: string;
    ventas: number | string;
    ganancia: number | string;
  }[];
  top_productos: {
    nombre_producto: string;
    unidades_vendidas: number | string;
    ingresos_totales: number | string;
    ganancia_generada: number | string;
  }[];
}

export default function TenantDashboardHome() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<AnalyticsData>("/tenant/analytics.php")
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="py-12 text-center text-slate-400">Cargando métricas financieras...</div>;
  }

  const maxVentaDia = Math.max(
    1,
    ...(data?.serie_7_dias.map((d) => Number(d.ventas)) || [1])
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rendimiento Financiero de Mi Negocio</h1>
        <p className="text-sm text-slate-500">
          Monitorea tus ventas, margen de ganancia real y productos estrella en tiempo real.
        </p>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs uppercase font-semibold text-slate-500">
            <span>Ventas de Hoy</span>
            <DollarSign className="w-5 h-5 text-indigo-500" />
          </div>
          <p className="text-3xl font-extrabold mt-2">
            ${data?.kpis.ventas_hoy.toFixed(2)}
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
            Ganancia neta hoy: +${data?.kpis.ganancia_hoy.toFixed(2)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs uppercase font-semibold text-slate-500">
            <span>Ventas del Mes</span>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-3xl font-extrabold mt-2 text-indigo-600 dark:text-indigo-400">
            ${data?.kpis.ventas_mes.toFixed(2)}
          </p>
          <p className="text-xs text-slate-500 mt-1">Ingresos brutos POS + Tienda Web</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs uppercase font-semibold text-slate-500">
            <span>Ganancia Neta (Mes)</span>
            <Award className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-3xl font-extrabold mt-2 text-emerald-600 dark:text-emerald-400">
            ${data?.kpis.ganancia_mes.toFixed(2)}
          </p>
          <p className="text-xs text-slate-500 mt-1">Descontando costo de compra</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs uppercase font-semibold text-slate-500">
            <span>Crédito Directo por Cobrar</span>
            <Wallet className="w-5 h-5 text-rose-500" />
          </div>
          <p className="text-3xl font-extrabold mt-2 text-rose-600 dark:text-rose-400">
            ${data?.kpis.total_fiados.toFixed(2)}
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {data?.kpis.productos_stock_bajo} productos con stock bajo
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              <h2>Evolución Últimos 7 Días (Ventas vs. Ganancia)</h2>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-indigo-600 inline-block" /> Ventas
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Ganancia
              </span>
            </div>
          </div>

          {data?.serie_7_dias.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">
              Aún no hay ventas registradas en los últimos 7 días.
            </p>
          ) : (
            <div className="h-60 flex items-end gap-4 pt-6 px-2 border-b border-slate-200 dark:border-slate-800">
              {data?.serie_7_dias.map((item) => {
                const v = Number(item.ventas);
                const g = Number(item.ganancia);
                const hVenta = Math.max(8, Math.round((v / maxVentaDia) * 180));
                const hGanancia = Math.max(6, Math.round((g / maxVentaDia) * 180));

                return (
                  <div
                    key={item.fecha}
                    className="flex-1 flex flex-col items-center gap-2 group"
                  >
                    <div className="text-[10px] font-bold text-slate-500 opacity-0 group-hover:opacity-100 transition">
                      ${v.toFixed(0)}
                    </div>
                    <div className="flex items-end gap-1.5 w-full justify-center">
                      <div
                        style={{ height: `${hVenta}px` }}
                        className="w-4 sm:w-5 rounded-t-lg bg-indigo-600 transition-all"
                        title={`Ventas: $${v.toFixed(2)}`}
                      />
                      <div
                        style={{ height: `${hGanancia}px` }}
                        className="w-4 sm:w-5 rounded-t-lg bg-emerald-500 transition-all"
                        title={`Ganancia: $${g.toFixed(2)}`}
                      />
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {item.fecha.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="lg:col-span-5 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
          <h2 className="font-bold">Top 5 Productos Más Vendidos (30d)</h2>
          <div className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
            {data?.top_productos.length === 0 ? (
              <p className="py-12 text-center text-slate-400">
                Sin datos de productos vendidos aún.
              </p>
            ) : (
              data?.top_productos.map((prod, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold">
                      {idx + 1}. {prod.nombre_producto}
                    </div>
                    <div className="text-xs text-slate-500">
                      {prod.unidades_vendidas} unidades vendidas
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-indigo-600 dark:text-indigo-400">
                      ${Number(prod.ingresos_totales).toFixed(2)}
                    </div>
                    <div className="text-xs text-emerald-600 dark:text-emerald-400">
                      Utilidad: +${Number(prod.ganancia_generada).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
