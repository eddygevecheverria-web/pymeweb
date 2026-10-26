"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  FileText,
  Download,
  Printer,
  RefreshCw,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Scale,
  DollarSign,
  PieChart,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

export default function EstadosFinancierosView() {
  const [subReporte, setSubReporte] = useState<"balance_comprobacion" | "estado_resultados" | "balance_general">("balance_comprobacion");
  const [desde, setDesde] = useState(`${new Date().getFullYear()}-01-01`);
  const [hasta, setHasta] = useState(new Date().toISOString().split("T")[0]);
  const [fechaCorte, setFechaCorte] = useState(new Date().toISOString().split("T")[0]);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  const loadReporte = async () => {
    setLoading(true);
    setError("");
    try {
      let url = `/tenant/accounting/reports.php?report=${subReporte}`;
      if (subReporte === "balance_general") {
        url += `&fecha_corte=${fechaCorte}`;
      } else {
        url += `&desde=${desde}&hasta=${hasta}`;
      }
      const res = await apiFetch(url);
      if (res.success) {
        setData(res.data);
      } else {
        setError(res.error || "Error al cargar reporte financiero.");
      }
    } catch (err: any) {
      setError(err.message || "Error al conectar con el servidor contable.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReporte();
  }, [subReporte]);

  // Descargar en formato CSV / Excel
  const handleExportCsv = () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("pymeweb_token") : "";
    let url = `http://localhost/pymeweb/backend-api/api/tenant/accounting/reports.php?report=${subReporte}&format=csv&token=${token}`;
    if (subReporte === "balance_general") {
      url += `&fecha_corte=${fechaCorte}`;
    } else {
      url += `&desde=${desde}&hasta=${hasta}`;
    }

    window.open(url, "_blank");
  };

  // Imprimir / Guardar en PDF
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5">
      {/* Selector de Estado Financiero y Filtros */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Selector de Tipo de Reporte */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl overflow-x-auto shrink-0">
          <button
            onClick={() => setSubReporte("balance_comprobacion")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              subReporte === "balance_comprobacion"
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Balance Comprobación</span>
          </button>

          <button
            onClick={() => setSubReporte("estado_resultados")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              subReporte === "estado_resultados"
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Estado de Resultados (P&L)</span>
          </button>

          <button
            onClick={() => setSubReporte("balance_general")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              subReporte === "balance_general"
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Balance General</span>
          </button>
        </div>

        {/* Filtros de Fechas y Acciones */}
        <div className="flex flex-wrap items-center gap-2">
          {subReporte === "balance_general" ? (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium">Al corte de:</span>
              <input
                type="date"
                value={fechaCorte}
                onChange={(e) => setFechaCorte(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-xs"
              />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium">Desde:</span>
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-xs"
              />
              <span className="text-slate-500 font-medium">Hasta:</span>
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-xs"
              />
            </div>
          )}

          <button
            onClick={loadReporte}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold"
            title="Recalcular"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/50 text-xs font-bold transition"
            title="Exportar a Excel / CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel / CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition"
            title="Imprimir / Exportar a PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir PDF</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-center gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. BALANCE DE COMPROBACIÓN (SUMAS Y SALDOS) */}
      {/* ========================================================================= */}
      {subReporte === "balance_comprobacion" && data && (
        <div className="space-y-4 animate-in fade-in">
          {/* Tarjeta de Validación de Partida Doble */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className={`p-4 rounded-2xl border ${
              data.totales?.cuadrado_sumas 
                ? "bg-emerald-50/30 border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300"
                : "bg-rose-50/40 border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300"
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Sumas Iguales (Debe / Haber)
                </span>
                <span className="text-xs font-mono font-bold">
                  {data.totales?.cuadrado_sumas ? "CUADRADO ✓" : "DESCUADRADO ✗"}
                </span>
              </div>
              <div className="flex justify-between font-mono text-sm mt-2">
                <span>Total Debe: <strong>${Number(data.totales?.total_debe).toFixed(2)}</strong></span>
                <span>Total Haber: <strong>${Number(data.totales?.total_haber).toFixed(2)}</strong></span>
              </div>
            </div>

            <div className={`p-4 rounded-2xl border ${
              data.totales?.cuadrado_saldos 
                ? "bg-emerald-50/30 border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300"
                : "bg-rose-50/40 border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300"
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Saldos Iguales (Deudor / Acreedor)
                </span>
                <span className="text-xs font-mono font-bold">
                  {data.totales?.cuadrado_saldos ? "CUADRADO ✓" : "DESCUADRADO ✗"}
                </span>
              </div>
              <div className="flex justify-between font-mono text-sm mt-2">
                <span>Saldo Deudor: <strong>${Number(data.totales?.total_saldo_deudor).toFixed(2)}</strong></span>
                <span>Saldo Acreedor: <strong>${Number(data.totales?.total_saldo_acreedor).toFixed(2)}</strong></span>
              </div>
            </div>
          </div>

          {/* Tabla de Sumas y Saldos */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-bold">Código</th>
                    <th className="py-3 px-4 font-bold">Nombre de la Cuenta</th>
                    <th className="py-3 px-3 font-bold text-center">Tipo</th>
                    <th className="py-3 px-3 font-bold text-right">Saldo Inicial</th>
                    <th className="py-3 px-3 font-bold text-right">Debe</th>
                    <th className="py-3 px-3 font-bold text-right">Haber</th>
                    <th className="py-3 px-3 font-bold text-right">Saldo Deudor</th>
                    <th className="py-3 px-4 font-bold text-right">Saldo Acreedor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.cuentas?.map((c: any) => {
                    const isParent = !c.acepta_movimiento;
                    const paddingLeft = (c.nivel - 1) * 16 + 12;

                    return (
                      <tr
                        key={c.id}
                        className={`transition ${
                          isParent
                            ? "bg-slate-50/70 dark:bg-slate-800/30 font-bold text-slate-900 dark:text-slate-100"
                            : "hover:bg-slate-50/40 dark:hover:bg-slate-800/20 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <td className="py-2.5 px-4 font-mono font-semibold">{c.codigo}</td>
                        <td className="py-2.5 px-4" style={{ paddingLeft: `${paddingLeft}px` }}>
                          {c.nombre}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-semibold">
                            {c.tipo}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          ${Number(c.saldo_inicial).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                          {Number(c.debe) > 0 ? `$${Number(c.debe).toFixed(2)}` : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-indigo-600 dark:text-indigo-400">
                          {Number(c.haber) > 0 ? `$${Number(c.haber).toFixed(2)}` : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          {Number(c.saldo_deudor) > 0 ? `$${Number(c.saldo_deudor).toFixed(2)}` : "-"}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold">
                          {Number(c.saldo_acreedor) > 0 ? `$${Number(c.saldo_acreedor).toFixed(2)}` : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold border-t-2 border-slate-300 dark:border-slate-700 font-mono">
                  <tr>
                    <td colSpan={4} className="py-3 px-4 uppercase text-right tracking-wider">
                      TOTALES GENERALES:
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-600 dark:text-emerald-400">
                      ${Number(data.totales?.total_debe).toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right text-indigo-600 dark:text-indigo-400">
                      ${Number(data.totales?.total_haber).toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      ${Number(data.totales?.total_saldo_deudor).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      ${Number(data.totales?.total_saldo_acreedor).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ESTADO DE RESULTADOS (P&L) */}
      {/* ========================================================================= */}
      {subReporte === "estado_resultados" && data && (
        <div className="space-y-4 animate-in fade-in">
          {/* Tarjeta de Resumen P&L */}
          <div className="grid sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400 font-semibold block">Ventas e Ingresos</span>
              <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1 block">
                ${Number(data.ingresos?.total).toFixed(2)}
              </span>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400 font-semibold block">Costo de Ventas</span>
              <span className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1 block">
                ${Number(data.costos?.total).toFixed(2)}
              </span>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400 font-semibold block">Gastos Operativos</span>
              <span className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1 block">
                ${Number(data.gastos?.total).toFixed(2)}
              </span>
            </div>
            <div className="bg-emerald-50/40 dark:bg-emerald-950/40 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/60">
              <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold block">
                Utilidad Neta del Ejercicio
              </span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block font-mono">
                ${Number(data.utilidad_neta_ejercicio).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Desglose Cascada P&L */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
            {/* 1. Ingresos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span> 4. INGRESOS OPERACIONALES
                </span>
                <span className="font-bold font-mono text-sm text-indigo-600 dark:text-indigo-400">
                  ${Number(data.ingresos?.total).toFixed(2)}
                </span>
              </div>
              <div className="space-y-1 pl-4">
                {data.ingresos?.items?.filter((i: any) => i.acepta_movimiento && i.saldo > 0).map((i: any) => (
                  <div key={i.id} className="flex justify-between text-xs text-slate-600 dark:text-slate-300 py-1">
                    <span>{i.codigo} - {i.nombre}</span>
                    <span className="font-mono">${Number(i.saldo).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Costos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span> 5. COSTO DE VENTAS (MERCADERÍAS)
                </span>
                <span className="font-bold font-mono text-sm text-amber-600 dark:text-amber-400">
                  (${Number(data.costos?.total).toFixed(2)})
                </span>
              </div>
              <div className="space-y-1 pl-4">
                {data.costos?.items?.filter((i: any) => i.acepta_movimiento && i.saldo > 0).map((i: any) => (
                  <div key={i.id} className="flex justify-between text-xs text-slate-600 dark:text-slate-300 py-1">
                    <span>{i.codigo} - {i.nombre}</span>
                    <span className="font-mono">${Number(i.saldo).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Subtotal: Utilidad Bruta */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex items-center justify-between font-bold text-xs">
              <span className="uppercase tracking-wider text-slate-700 dark:text-slate-200">
                = UTILIDAD BRUTA EN VENTAS:
              </span>
              <span className="font-mono text-sm text-slate-900 dark:text-slate-100">
                ${Number(data.utilidad_bruta).toFixed(2)}
              </span>
            </div>

            {/* 3. Gastos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span> 6. GASTOS DE OPERACIÓN Y ADMINISTRACIÓN
                </span>
                <span className="font-bold font-mono text-sm text-rose-600 dark:text-rose-400">
                  (${Number(data.gastos?.total).toFixed(2)})
                </span>
              </div>
              <div className="space-y-1 pl-4">
                {data.gastos?.items?.filter((i: any) => i.acepta_movimiento && i.saldo > 0).map((i: any) => (
                  <div key={i.id} className="flex justify-between text-xs text-slate-600 dark:text-slate-300 py-1">
                    <span>{i.codigo} - {i.nombre}</span>
                    <span className="font-mono">${Number(i.saldo).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Subtotal: Utilidad Operacional */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex items-center justify-between font-bold text-xs">
              <span className="uppercase tracking-wider text-slate-700 dark:text-slate-200">
                = UTILIDAD OPERACIONAL:
              </span>
              <span className="font-mono text-sm text-slate-900 dark:text-slate-100">
                ${Number(data.utilidad_operacional).toFixed(2)}
              </span>
            </div>

            {/* Deducciones tributarias Ecuador */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>(-) 15% Participación de Trabajadores (Ecuador):</span>
                <span className="font-mono">(${Number(data.participacion_15_trab).toFixed(2)})</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>(=) Utilidad antes de Impuesto a la Renta:</span>
                <span className="font-mono font-bold">${Number(data.utilidad_antes_impuestos).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>(-) 25% Impuesto a la Renta Sociedades:</span>
                <span className="font-mono">(${Number(data.impuesto_renta_25).toFixed(2)})</span>
              </div>
            </div>

            {/* Total: Utilidad Neta */}
            <div className="p-4 bg-emerald-500/10 border-2 border-emerald-500/30 rounded-2xl flex items-center justify-between">
              <span className="font-black text-sm uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                UTILIDAD NETA DEL EJERCICIO:
              </span>
              <span className="font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400">
                ${Number(data.utilidad_neta_ejercicio).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. BALANCE GENERAL (ESTADO DE SITUACIÓN FINANCIERA) */}
      {/* ========================================================================= */}
      {subReporte === "balance_general" && data && (
        <div className="space-y-4 animate-in fade-in">
          {/* Tarjeta de Verificación de Ecuación Contable */}
          <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            data.resumen?.cuadrado
              ? "bg-emerald-50/40 border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50/40 border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300"
          }`}>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold text-xs uppercase tracking-wider block">
                  Ecuación Patrimonial NIIF: Activo = Pasivo + Patrimonio
                </span>
                <span className="text-[11px] opacity-80">
                  {data.resumen?.cuadrado
                    ? "El balance cuadra perfectamente con diferencia de $0.00."
                    : `Existe un descuadre contable de $${data.resumen?.diferencia}.`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono font-bold">
              <span>Activo: ${Number(data.resumen?.total_activo).toFixed(2)}</span>
              <span>==</span>
              <span>Pasivo + Pat: ${Number(data.resumen?.total_pasivo_mas_patrimonio).toFixed(2)}</span>
            </div>
          </div>

          {/* Columnas Activo vs Pasivo + Patrimonio */}
          <div className="grid lg:grid-cols-2 gap-4">
            {/* 1. ACTIVOS */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> 1. ACTIVOS TOTALES
                </h3>
                <span className="font-mono text-base font-black text-emerald-600 dark:text-emerald-400">
                  ${Number(data.activos?.total).toFixed(2)}
                </span>
              </div>

              <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                {data.activos?.items?.map((item: any) => {
                  const isParent = !item.acepta_movimiento;
                  const pl = (item.nivel - 1) * 12 + 4;
                  return (
                    <div
                      key={item.codigo}
                      style={{ paddingLeft: `${pl}px` }}
                      className={`flex justify-between py-1 text-xs ${
                        isParent
                          ? "font-bold text-slate-900 dark:text-slate-100 pt-2"
                          : "text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      <span className="truncate pr-2">{item.codigo} - {item.nombre}</span>
                      <span className="font-mono font-semibold">${Number(item.saldo).toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. PASIVOS Y PATRIMONIO */}
            <div className="space-y-4">
              {/* Pasivos */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> 2. PASIVOS TOTALES
                  </h3>
                  <span className="font-mono text-base font-black text-rose-600 dark:text-rose-400">
                    ${Number(data.pasivos?.total).toFixed(2)}
                  </span>
                </div>

                <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
                  {data.pasivos?.items?.map((item: any) => {
                    const isParent = !item.acepta_movimiento;
                    const pl = (item.nivel - 1) * 12 + 4;
                    return (
                      <div
                        key={item.codigo}
                        style={{ paddingLeft: `${pl}px` }}
                        className={`flex justify-between py-0.5 text-xs ${
                          isParent ? "font-bold text-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        <span className="truncate pr-2">{item.codigo} - {item.nombre}</span>
                        <span className="font-mono">${Number(item.saldo).toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Patrimonio */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> 3. PATRIMONIO NETO
                  </h3>
                  <span className="font-mono text-base font-black text-indigo-600 dark:text-indigo-400">
                    ${Number(data.patrimonio?.total).toFixed(2)}
                  </span>
                </div>

                <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
                  {data.patrimonio?.items?.map((item: any) => {
                    const isParent = !item.acepta_movimiento;
                    const pl = (item.nivel - 1) * 12 + 4;
                    return (
                      <div
                        key={item.codigo}
                        style={{ paddingLeft: `${pl}px` }}
                        className={`flex justify-between py-0.5 text-xs ${
                          isParent ? "font-bold text-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        <span className="truncate pr-2">{item.codigo} - {item.nombre}</span>
                        <span className="font-mono">${Number(item.saldo).toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
