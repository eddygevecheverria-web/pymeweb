"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  FileCode2,
  Download,
  Calendar,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShoppingCart,
  DollarSign,
  Receipt,
  FileCheck2,
  Info,
  ExternalLink,
} from "lucide-react";

const MESES = [
  { val: 1, label: "01 - Enero" },
  { val: 2, label: "02 - Febrero" },
  { val: 3, label: "03 - Marzo" },
  { val: 4, label: "04 - Abril" },
  { val: 5, label: "05 - Mayo" },
  { val: 6, label: "06 - Junio" },
  { val: 7, label: "07 - Julio" },
  { val: 8, label: "08 - Agosto" },
  { val: 9, label: "09 - Septiembre" },
  { val: 10, label: "10 - Octubre" },
  { val: 11, label: "11 - Noviembre" },
  { val: 12, label: "12 - Diciembre" },
];

export default function AtsSriView() {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [resumen, setResumen] = useState<any>(null);
  const [error, setError] = useState("");

  const loadResumen = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/sri/ats.php?action=resumen&anio=${anio}&mes=${mes}`);
      if (res.success) {
        setResumen(res);
      } else {
        setError(res.error || "Error al cargar resumen del ATS.");
      }
    } catch (err: any) {
      setError(err.message || "Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResumen();
  }, [anio, mes]);

  const handleDownloadXml = () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("pymeweb_token") || "" : "";
    const url = `http://localhost/pymeweb/backend-api/api/sri/ats.php?action=download_xml&anio=${anio}&mes=${mes}&token=${token}`;
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Barra de Filtros Periodo ATS */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <FileCode2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Anexo Transaccional Simplificado (ATS SRI Ecuador)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Generador del reporte XML mensual de compras, ventas y retenciones conforme a la ficha técnica del SRI.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-xs">
            <select
              value={anio}
              onChange={(e) => setAnio(Number(e.target.value))}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-xs font-bold"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  Año {y}
                </option>
              ))}
            </select>

            <select
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-xs font-bold"
            >
              {MESES.map((m) => (
                <option key={m.val} value={m.val}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={loadResumen}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleDownloadXml}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-md shadow-indigo-600/20"
          >
            <Download className="w-4 h-4" />
            <span>Descargar XML ATS</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Info Informativa SRI */}
      <div className="p-4 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-700 dark:text-indigo-300 flex items-start gap-3">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong>Validación Oficial del SRI:</strong> El archivo descargado contiene la etiqueta raíz <code>&lt;iva&gt;</code> y agrupa todas tus compras registradas con proveedores locales, ventas emitidas en el POS y facturación electrónica, así como las retenciones de Renta (cód. 312) e IVA aplicadas y recibidas. Puedes cargarlo directamente en el validador del DIMM Formularios o SRI en Línea.
        </div>
      </div>

      {/* Tarjetas del Resumen Mensual */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Compras */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Compras Reportadas
            </span>
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShoppingCart className="w-4 h-4" />
            </span>
          </div>
          <span className="text-2xl font-black text-slate-800 dark:text-slate-100 block font-mono">
            ${Number(resumen?.compras?.subtotal || 0).toFixed(2)}
          </span>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 flex justify-between">
            <span>Facturas: {resumen?.compras?.cantidad || 0}</span>
            <span>IVA: ${Number(resumen?.compras?.iva || 0).toFixed(2)}</span>
          </div>
        </div>

        {/* Ventas */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Ventas Reportadas
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <span className="text-2xl font-black text-slate-800 dark:text-slate-100 block font-mono">
            ${Number(resumen?.ventas?.subtotal || 0).toFixed(2)}
          </span>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 flex justify-between">
            <span>Comprobantes: {resumen?.ventas?.cantidad || 0}</span>
            <span>IVA: ${Number(resumen?.ventas?.iva || 0).toFixed(2)}</span>
          </div>
        </div>

        {/* Retenciones de Clientes */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Retenciones Recibidas
            </span>
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Receipt className="w-4 h-4" />
            </span>
          </div>
          <span className="text-2xl font-black text-slate-800 dark:text-slate-100 block font-mono">
            ${Number(resumen?.retenciones_recibidas?.total || 0).toFixed(2)}
          </span>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 flex justify-between">
            <span>Renta: ${Number(resumen?.retenciones_recibidas?.ret_renta || 0).toFixed(2)}</span>
            <span>IVA: ${Number(resumen?.retenciones_recibidas?.ret_iva || 0).toFixed(2)}</span>
          </div>
        </div>

        {/* Comprobantes SRI */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Comprobantes SRI
            </span>
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <FileCheck2 className="w-4 h-4" />
            </span>
          </div>
          <span className="text-2xl font-black text-slate-800 dark:text-slate-100 block font-mono">
            {resumen?.comprobantes_sri?.total_emitidos || 0}
          </span>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 flex justify-between">
            <span>Autorizados: {resumen?.comprobantes_sri?.autorizados_sri || 0}</span>
            <span>NC: {resumen?.comprobantes_sri?.notas_credito || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
