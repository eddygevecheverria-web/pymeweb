"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  RefreshCw,
  Scale,
  Calendar,
  AlertCircle,
  Activity,
  CheckCircle2,
  PieChart,
} from "lucide-react";

export default function MetricasFinancierasView() {
  const [desde, setDesde] = useState(`${new Date().getFullYear()}-01-01`);
  const [hasta, setHasta] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);
  const [error, setError] = useState("");

  const loadMetrics = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/tenant/accounting/reports.php?report=metricas_financieras&desde=${desde}&hasta=${hasta}`);
      if (res.success) {
        setMetrics(res.data);
      } else {
        setError(res.error || "Error al calcular métricas financieras.");
      }
    } catch (err: any) {
      setError(err.message || "Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  if (loading && !metrics) {
    return (
      <div className="py-16 text-center text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-500" />
        <p className="text-xs">Calculando ratios financieros en tiempo real...</p>
      </div>
    );
  }

  const liquidez = metrics?.liquidez_corriente || 0;
  const pruebaAcida = metrics?.prueba_acida || 0;
  const cxc = metrics?.cuentas_por_cobrar || 0;
  const cxp = metrics?.cuentas_por_pagar || 0;
  const capitalTrabajo = metrics?.capital_de_trabajo || 0;
  const flujoNeto = metrics?.flujo_efectivo?.neto || 0;

  // Estado de salud del ratio de liquidez
  const liquidezColor =
    liquidez >= 1.5
      ? "text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/20"
      : liquidez >= 1.0
      ? "text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/50 bg-amber-50/20"
      : "text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50 bg-rose-50/20";

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Barra de Filtros */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Tablero de Ratios & Salud Financiera</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Indicadores de solvencia, liquidez inmediata, capital de trabajo y márgenes calculados del Libro Diario.
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500">Desde:</span>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-xs"
            />
            <span className="text-slate-500">Hasta:</span>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-xs"
            />
          </div>
          <button
            onClick={loadMetrics}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid de Ratios Principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ratio Liquidez */}
        <div className={`p-5 rounded-2xl border ${liquidezColor} transition flex flex-col justify-between shadow-sm`}>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider block opacity-80">
              Ratio de Liquidez Corriente
            </span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-black font-mono">{liquidez}</span>
              <span className="text-xs font-semibold">x pasivos</span>
            </div>
          </div>
          <p className="text-[11px] mt-3 opacity-90 leading-tight">
            {liquidez >= 1.5
              ? "Excelente: Tienes más de $1.50 en activos líquidos por cada $1.00 de deuda."
              : liquidez >= 1.0
              ? "Equilibrado: Activos corrientes cubren tus pasivos a corto plazo."
              : "Alerta: Deudas a corto plazo superan tus activos corrientes."}
          </p>
        </div>

        {/* Prueba Ácida */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">
              Prueba Ácida (Sin Inventarios)
            </span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-black font-mono text-slate-800 dark:text-slate-100">
                {pruebaAcida}
              </span>
              <span className="text-xs text-slate-400 font-semibold">x pasivos</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 leading-tight">
            Capacidad de pago inmediata en Caja, Bancos y CxC sin necesidad de liquidar mercadería.
          </p>
        </div>

        {/* Capital de Trabajo */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">
              Capital de Trabajo Neto
            </span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className={`text-2xl font-black font-mono ${capitalTrabajo >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                ${Number(capitalTrabajo).toFixed(2)}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 leading-tight">
            Fondo de maniobra operativo disponible tras restar Pasivo Corriente de Activo Corriente.
          </p>
        </div>

        {/* Flujo Neto de Efectivo */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">
              Flujo Neto de Efectivo
            </span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className={`text-2xl font-black font-mono ${flujoNeto >= 0 ? "text-indigo-600 dark:text-indigo-400" : "text-rose-600 dark:text-rose-400"}`}>
                ${Number(flujoNeto).toFixed(2)}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-3 border-t border-slate-100 dark:border-slate-800 pt-2 font-mono">
            <span>In: ${Number(metrics?.flujo_efectivo?.entradas || 0).toFixed(2)}</span>
            <span>Out: ${Number(metrics?.flujo_efectivo?.salidas || 0).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Ratios de Rentabilidad y Cuentas por Cobrar/Pagar */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Cuentas por Cobrar vs Cuentas por Pagar */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
              Cuentas por Cobrar (Clientes) vs Cuentas por Pagar (Proveedores)
            </h3>
            <Scale className="w-4 h-4 text-slate-400" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3.5 bg-emerald-50/30 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block uppercase">
                Por Cobrar a Clientes
              </span>
              <span className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">
                ${Number(cxc).toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">Activo Circulante</span>
            </div>

            <div className="p-3.5 bg-rose-50/30 dark:bg-rose-950/20 rounded-xl border border-rose-200 dark:border-rose-900/50">
              <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 block uppercase">
                Por Pagar a Proveedores
              </span>
              <span className="text-xl font-black font-mono text-rose-600 dark:text-rose-400 mt-1 block">
                ${Number(cxp).toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">Pasivo Exigible</span>
            </div>
          </div>

          {/* Barra de Proporción */}
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between text-xs text-slate-500 font-semibold">
              <span>Proporción CxC / CxP:</span>
              <span>{cxp > 0 ? (cxc / cxp).toFixed(2) + "x" : "Sin deudas"}</span>
            </div>
            <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${(cxc + cxp) > 0 ? (cxc / (cxc + cxp)) * 100 : 50}%` }}
                className="bg-emerald-500 transition-all duration-500"
                title="Por cobrar"
              ></div>
              <div
                style={{ width: `${(cxc + cxp) > 0 ? (cxp / (cxc + cxp)) * 100 : 50}%` }}
                className="bg-rose-500 transition-all duration-500"
                title="Por pagar"
              ></div>
            </div>
          </div>
        </div>

        {/* Márgenes Operativos */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
              Márgenes de Rentabilidad sobre Ventas
            </h3>
            <Percent className="w-4 h-4 text-slate-400" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <span className="text-[11px] font-bold text-slate-500 block uppercase">
                Margen Bruto
              </span>
              <span className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400 mt-1 block">
                {metrics?.margen_bruto_pct || 0}%
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">Sobre ventas totales</span>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <span className="text-[11px] font-bold text-slate-500 block uppercase">
                Margen Neto
              </span>
              <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">
                {metrics?.margen_neto_pct || 0}%
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">Ganancia final neta</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-slate-500 flex items-center justify-between font-mono">
            <span>Ventas Facturadas: ${Number(metrics?.ventas_totales || 0).toFixed(2)}</span>
            <span>Utilidad Neta: ${Number(metrics?.utilidad_neta || 0).toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
