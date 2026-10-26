"use client";

import { useEffect, useState, useRef } from "react";
import { apiFetch } from "@/lib/api";
import {
  Printer,
  FileText,
  Receipt,
  Settings2,
  X,
  Check,
  Download,
  Barcode,
  Building2,
  User,
  Calendar,
  CreditCard,
  Loader2,
} from "lucide-react";

export interface PrinterConfig {
  type: "ticket" | "normal"; // 'ticket' (80mm/58mm) o 'normal' (A4)
  ticketWidth: "80mm" | "58mm";
  autoPrint: boolean;
}

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  type: "ticket",
  ticketWidth: "80mm",
  autoPrint: true,
};

export function getPrinterConfig(): PrinterConfig {
  if (typeof window === "undefined") return DEFAULT_PRINTER_CONFIG;
  try {
    const saved = localStorage.getItem("pymeweb_printer_config");
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error(e);
  }
  return DEFAULT_PRINTER_CONFIG;
}

export function savePrinterConfig(cfg: PrinterConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("pymeweb_printer_config", JSON.stringify(cfg));
}

interface InvoicePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  ventaId: number | null;
  initialData?: any;
  autoTriggerPrint?: boolean;
}

export default function InvoicePrintModal({
  isOpen,
  onClose,
  ventaId,
  initialData,
  autoTriggerPrint = false,
}: InvoicePrintModalProps) {
  const [config, setConfig] = useState<PrinterConfig>(DEFAULT_PRINTER_CONFIG);
  const [data, setData] = useState<any>(initialData || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"ticket" | "normal">("ticket");
  const [showConfig, setShowConfig] = useState(false);
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      hasTriggeredRef.current = false;
      const saved = getPrinterConfig();
      setConfig(saved);
      setActiveTab(saved.type);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !ventaId) return;
    if (initialData && initialData.venta?.id === ventaId) {
      setData(initialData);
      return;
    }

    setLoading(true);
    setError("");
    apiFetch(`/tenant/invoice.php?venta_id=${ventaId}`)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        setError(err.message || "Error al cargar datos del comprobante para imprimir.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, ventaId, initialData]);

  // Disparo automático de la ventana de impresión de la factura al cobrar
  useEffect(() => {
    if (!isOpen || !data || loading) return;
    if (hasTriggeredRef.current) return;

    if (autoTriggerPrint || config.autoPrint) {
      hasTriggeredRef.current = true;
      const timer = setTimeout(() => {
        triggerPrint(activeTab);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen, data, loading, activeTab, autoTriggerPrint, config.autoPrint]);

  if (!isOpen) return null;

  const handleUpdateConfig = (newCfg: Partial<PrinterConfig>) => {
    const updated = { ...config, ...newCfg };
    setConfig(updated);
    savePrinterConfig(updated);
  };

  // Desglose de impuestos dinámicos
  const items: any[] = data?.items || [];
  let subtotal0 = 0;
  let subtotal15 = 0;
  let totalIva = 0;

  items.forEach((item) => {
    const tarifa = Number(item.sri_tarifa_iva ?? 15);
    const sub = Number(item.subtotal ?? 0);
    if (tarifa === 0) {
      subtotal0 += sub;
    } else {
      const base = sub / (1 + tarifa / 100);
      subtotal15 += base;
      totalIva += sub - base;
    }
  });

  const total = Number(data?.venta?.total ?? 0);
  const subtotalNeto = Number(data?.venta?.subtotal ?? (subtotal0 + subtotal15));
  const impuestoTotal = Number(data?.venta?.impuesto ?? totalIva);
  const metodoPago = data?.venta?.metodo_pago === "fiado" ? "Crédito Directo" : (data?.venta?.metodo_pago ?? "efectivo");
  const montoRecibido = Number(data?.venta?.monto_recibido ?? total);
  const vuelto = Number(data?.venta?.vuelto ?? 0);

  const negocioNombre = data?.sri?.razon_social || data?.negocio?.nombre || "PymeWeb Store";
  const negocioRuc = data?.sri?.ruc || data?.negocio?.ruc_nit || "9999999999001";
  const negocioDir = data?.sri?.dir_matriz || data?.negocio?.direccion || "Ecuador";
  const negocioTel = data?.negocio?.telefono || "";
  const numComprobante = data?.factura?.numero_comprobante || `Venta #${data?.venta?.id || ventaId}`;
  const claveAcceso = data?.factura?.clave_acceso || "";
  const estadoSri = data?.factura?.estado_sri || "EMITIDA";
  const ambiente = data?.sri?.ambiente === 2 ? "PRODUCCIÓN" : "PRUEBAS";
  const fechaEmision = data?.factura?.fecha_emision || data?.venta?.created_at || new Date().toLocaleString();

  // Función de Impresión limpia vía Iframe
  const triggerPrint = (format: "ticket" | "normal") => {
    const printArea = document.getElementById(
      format === "ticket" ? "printable-ticket-content" : "printable-a4-content"
    );
    if (!printArea) return;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0px";
    iframe.style.height = "0px";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    const isTicket = format === "ticket";
    const widthStyle = isTicket
      ? config.ticketWidth === "58mm"
        ? "58mm"
        : "80mm"
      : "210mm";

    const pageCss = isTicket
      ? `@page { size: ${widthStyle} auto; margin: 3mm; }`
      : `@page { size: A4 portrait; margin: 12mm 15mm; }`;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Impresión_${numComprobante}</title>
          <meta charset="utf-8">
          <style>
            ${pageCss}
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              color: #000;
              background: #fff;
              font-size: ${isTicket ? (config.ticketWidth === "58mm" ? "10px" : "12px") : "12px"};
              line-height: 1.3;
              padding: ${isTicket ? "0" : "10px"};
              width: 100%;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .text-left { text-align: left; }
            .font-bold { font-weight: 700; }
            .font-mono { font-family: monospace, Courier, sans-serif; }
            .uppercase { text-transform: uppercase; }
            .border-b { border-bottom: 1px dashed #444; }
            .border-t { border-top: 1px dashed #444; }
            .border-double { border-top: 3px double #000; }
            .border-box { border: 1px solid #222; border-radius: 4px; padding: 8px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 3px 2px; }
            .badge {
              display: inline-block;
              padding: 2px 6px;
              font-size: 10px;
              border: 1px solid #333;
              border-radius: 3px;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          ${printArea.innerHTML}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Cabecera del Modal */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Imprimir Comprobante
                <span className="text-xs font-mono font-normal px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {numComprobante}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Selecciona el formato de impresión según tu dispositivo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                showConfig
                  ? "bg-indigo-50 border-indigo-300 text-indigo-600 dark:bg-indigo-950 dark:border-indigo-800 dark:text-indigo-300"
                  : "border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              }`}
              title="Configuración de Impresora"
            >
              <Settings2 className="w-4 h-4" />
              <span className="hidden sm:inline">Configuración</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Panel Desplegable de Configuración de Impresora */}
        {showConfig && (
          <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/30 border-b border-indigo-200 dark:border-indigo-900/50 animate-fade-in text-xs space-y-3">
            <div className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
              <Settings2 className="w-4 h-4" />
              Configuración Predeterminada de Impresora
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                  Tipo de Impresora por Defecto:
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleUpdateConfig({ type: "ticket" })}
                    className={`py-1.5 px-2.5 rounded-lg border font-semibold flex items-center justify-center gap-1 text-xs transition ${
                      config.type === "ticket"
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                        : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5" /> Ticket
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateConfig({ type: "normal" })}
                    className={`py-1.5 px-2.5 rounded-lg border font-semibold flex items-center justify-center gap-1 text-xs transition ${
                      config.type === "normal"
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                        : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" /> Normal (A4)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                  Ancho de Papel Térmico:
                </label>
                <select
                  value={config.ticketWidth}
                  onChange={(e) =>
                    handleUpdateConfig({
                      ticketWidth: e.target.value as "80mm" | "58mm",
                    })
                  }
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 outline-none font-medium"
                >
                  <option value="80mm">80 mm (Estándar POS térmico)</option>
                  <option value="58mm">58 mm (Mini térmica portátil)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                  Comportamiento al Cobrar:
                </label>
                <label className="flex items-center gap-2 p-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.autoPrint}
                    onChange={(e) =>
                      handleUpdateConfig({ autoPrint: e.target.checked })
                    }
                    className="rounded text-indigo-600"
                  />
                  <span className="text-[11px] font-medium">
                    Abrir diálogo de impresión automático
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Barra de Pestañas: Ticket vs A4 */}
        <div className="flex items-center justify-between px-6 pt-3 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("ticket")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === "ticket"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Ticket Térmico ({config.ticketWidth})</span>
              {config.type === "ticket" && (
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-indigo-500/30 text-indigo-200 uppercase">
                  Predeterminada
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("normal")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === "normal"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Hoja Normal (A4 / Carta)</span>
              {config.type === "normal" && (
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-indigo-500/30 text-indigo-200 uppercase">
                  Predeterminada
                </span>
              )}
            </button>
          </div>

          <button
            onClick={() => triggerPrint(activeTab)}
            disabled={loading || !data}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition active:scale-95 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir en {activeTab === "ticket" ? `Ticket ${config.ticketWidth}` : "A4 Normal"}</span>
          </button>
        </div>

        {/* Contenido / Vista Previa */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-950 flex justify-center items-start">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-xs">Cargando datos para impresión...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-red-50 text-red-600 border border-red-200 text-xs">
              {error}
            </div>
          ) : !data ? null : (
            <div className="w-full flex justify-center">
              {/* VISTA 1: TICKET TÉRMICO (80mm o 58mm) */}
              {activeTab === "ticket" && (
                <div
                  id="printable-ticket-content"
                  className={`bg-white text-black p-4 shadow-xl border border-slate-300 font-mono text-xs rounded-lg transition-all ${
                    config.ticketWidth === "58mm" ? "max-w-[280px]" : "max-w-[340px]"
                  }`}
                  style={{ width: "100%" }}
                >
                  <div className="text-center space-y-1 pb-2 border-b border-dashed border-neutral-400">
                    <div className="text-sm font-bold uppercase tracking-tight">
                      {negocioNombre}
                    </div>
                    {data?.sri?.nombre_comercial && data?.sri?.nombre_comercial !== negocioNombre && (
                      <div className="text-[11px] font-bold text-neutral-700">
                        {data.sri.nombre_comercial}
                      </div>
                    )}
                    <div className="text-[11px]">RUC: {negocioRuc}</div>
                    <div className="text-[10px] leading-tight text-neutral-600">
                      Matriz: {negocioDir}
                    </div>
                    {negocioTel && (
                      <div className="text-[10px] text-neutral-600">Tel: {negocioTel}</div>
                    )}
                    {data?.sri?.obligado_contabilidad && (
                      <div className="text-[10px] text-neutral-600">
                        Obligado Contabilidad: {data.sri.obligado_contabilidad}
                      </div>
                    )}
                    {data?.sri?.tipo_contribuyente === "RIMPE_EMPRENDEDOR" && (
                      <div className="text-[10px] font-bold uppercase">
                        CONTRIBUYENTE RÉGIMEN RIMPE
                      </div>
                    )}
                    {data?.sri?.tipo_contribuyente === "RIMPE_NEGOCIO_POPULAR" && (
                      <div className="text-[10px] font-bold uppercase">
                        NEGOCIO POPULAR - RÉGIMEN RIMPE
                      </div>
                    )}
                  </div>

                  <div className="py-2 space-y-1 text-[11px] border-b border-dashed border-neutral-400">
                    <div className="font-bold flex justify-between">
                      <span>FACTURA:</span>
                      <span>{numComprobante}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span>FECHA:</span>
                      <span>{fechaEmision}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span>AMBIENTE:</span>
                      <span>{ambiente}</span>
                    </div>
                    <div className="pt-1 text-[11px]">
                      <div><strong>CLIENTE:</strong> {data?.cliente?.nombre || "CONSUMIDOR FINAL"}</div>
                      <div><strong>RUC/C.I.:</strong> {data?.cliente?.documento || "9999999999999"}</div>
                      {data?.cliente?.direccion && (
                        <div className="text-[10px]"><strong>DIR:</strong> {data.cliente.direccion}</div>
                      )}
                      {data?.cliente?.telefono && (
                        <div className="text-[10px]"><strong>TEL:</strong> {data.cliente.telefono}</div>
                      )}
                    </div>
                  </div>

                  {/* Tabla de Productos Ticket */}
                  <table className="w-full text-[11px] my-2">
                    <thead>
                      <tr className="border-b border-dashed border-neutral-400 text-left">
                        <th className="pb-1">CANT</th>
                        <th className="pb-1">DESCRIPCIÓN</th>
                        <th className="pb-1 text-right">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dashed divide-neutral-200">
                      {items.map((it, idx) => (
                        <tr key={idx} className="align-top">
                          <td className="py-1 font-bold">{it.cantidad}</td>
                          <td className="py-1 pr-1">
                            <div>{it.nombre_producto}</div>
                            <div className="text-[9px] text-neutral-500">
                              ${Number(it.precio_unitario).toFixed(2)} c/u
                              {Number(it.sri_tarifa_iva) === 0 ? " (IVA 0%)" : " (IVA 15%)"}
                            </div>
                          </td>
                          <td className="py-1 text-right font-bold">
                            ${Number(it.subtotal).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Totales Ticket */}
                  <div className="pt-1 border-t border-dashed border-neutral-400 space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span>SUBTOTAL 0%:</span>
                      <span>${subtotal0.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SUBTOTAL 15%:</span>
                      <span>${subtotal15.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SUBTOTAL NETO:</span>
                      <span>${subtotalNeto.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>IVA 15%:</span>
                      <span>${impuestoTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-sm pt-1 border-t border-neutral-800">
                      <span>TOTAL A PAGAR:</span>
                      <span>${total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] pt-1 border-t border-dashed border-neutral-300">
                      <span>FORMA DE PAGO:</span>
                      <span className="uppercase font-bold">{metodoPago}</span>
                    </div>
                    {data?.venta?.comprobante_transferencia && (
                      <div className="flex justify-between text-[10px]">
                        <span>N° COMPR./DEPÓSITO:</span>
                        <span className="font-bold">{data.venta.comprobante_transferencia}</span>
                      </div>
                    )}
                    {data?.venta?.metodo_pago === "efectivo" && (
                      <>
                        <div className="flex justify-between text-[10px]">
                          <span>RECIBIDO:</span>
                          <span>${montoRecibido.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold">
                          <span>CAMBIO / VUELTO:</span>
                          <span>${vuelto.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Clave de Acceso SRI */}
                  {claveAcceso && (
                    <div className="mt-3 pt-2 border-t border-dashed border-neutral-400 text-center space-y-1">
                      <div className="text-[9px] font-bold uppercase">
                        CLAVE DE ACCESO SRI (49 DÍGITOS):
                      </div>
                      <div className="text-[8px] font-mono break-all bg-neutral-100 p-1 rounded border border-neutral-300">
                        {claveAcceso}
                      </div>
                      <div className="text-[9px] text-neutral-600">
                        Estado: <strong>{estadoSri}</strong>
                      </div>
                    </div>
                  )}

                  <div className="text-center pt-3 text-[10px] text-neutral-600 space-y-0.5">
                    <p className="font-bold">¡Gracias por su preferencia!</p>
                    <p className="text-[8px]">Software POS PymeWeb • Facturación Legal SRI</p>
                  </div>
                </div>
              )}

              {/* VISTA 2: FACTURA A4 ESTÁNDAR / NORMAL */}
              {activeTab === "normal" && (
                <div
                  id="printable-a4-content"
                  className="bg-white text-slate-900 p-8 shadow-2xl border border-slate-300 rounded-xl text-xs max-w-3xl w-full space-y-6"
                >
                  {/* Encabezado A4: Emisor + Cuadro Tributario SRI */}
                  <div className="grid grid-cols-2 gap-6 items-start">
                    {/* Izquierda: Emisor */}
                    <div className="space-y-3">
                      <div>
                        <h1 className="text-xl font-bold uppercase tracking-tight text-slate-900">
                          {negocioNombre}
                        </h1>
                        {data?.sri?.nombre_comercial && (
                          <div className="text-xs font-semibold text-slate-600">
                            {data.sri.nombre_comercial}
                          </div>
                        )}
                      </div>
                      <div className="space-y-1 text-slate-600">
                        <div><strong>Dirección Matriz:</strong> {negocioDir}</div>
                        {data?.sri?.dir_establecimiento && (
                          <div><strong>Dirección Sucursal:</strong> {data.sri.dir_establecimiento}</div>
                        )}
                        {negocioTel && <div><strong>Teléfono:</strong> {negocioTel}</div>}
                        <div>
                          <strong>Obligado a llevar contabilidad:</strong>{" "}
                          {data?.sri?.obligado_contabilidad || "NO"}
                        </div>
                        {data?.sri?.tipo_contribuyente === "RIMPE_EMPRENDEDOR" && (
                          <div className="font-bold text-slate-800">
                            CONTRIBUYENTE RÉGIMEN RIMPE
                          </div>
                        )}
                        {data?.sri?.tipo_contribuyente === "RIMPE_NEGOCIO_POPULAR" && (
                          <div className="font-bold text-slate-800">
                            CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Derecha: Cuadro SRI Oficial */}
                    <div className="border border-slate-800 rounded-xl p-4 bg-slate-50/50 space-y-2">
                      <div className="font-bold text-sm">R.U.C.: {negocioRuc}</div>
                      <div className="text-base font-black text-indigo-900 tracking-wider">
                        FACTURA
                      </div>
                      <div className="text-xs font-bold text-slate-800">
                        No. {numComprobante}
                      </div>
                      <div className="pt-1 text-[11px] space-y-1">
                        <div>
                          <strong>NÚMERO DE AUTORIZACIÓN:</strong>
                          <div className="font-mono text-[10px] break-all">{claveAcceso || "PENDIENTE"}</div>
                        </div>
                        <div className="flex justify-between">
                          <span><strong>FECHA:</strong> {fechaEmision}</span>
                          <span><strong>AMBIENTE:</strong> {ambiente}</span>
                        </div>
                        <div>
                          <strong>EMISIÓN:</strong> NORMAL
                        </div>
                        {claveAcceso && (
                          <div>
                            <strong>CLAVE DE ACCESO:</strong>
                            <div className="p-1.5 bg-white border border-slate-300 rounded font-mono text-[9px] break-all tracking-wider text-center font-bold">
                              {claveAcceso}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Datos del Cliente A4 */}
                  <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/70 grid grid-cols-2 gap-3">
                    <div>
                      <div>
                        <strong>Razón Social / Nombres:</strong>{" "}
                        {data?.cliente?.nombre || "CONSUMIDOR FINAL"}
                      </div>
                      <div>
                        <strong>Identificación:</strong>{" "}
                        {data?.cliente?.documento || "9999999999999"}
                      </div>
                      <div>
                        <strong>Fecha Emisión:</strong> {fechaEmision}
                      </div>
                    </div>
                    <div>
                      <div>
                        <strong>Dirección:</strong> {data?.cliente?.direccion || "S/N"}
                      </div>
                      <div>
                        <strong>Teléfono:</strong> {data?.cliente?.telefono || "S/N"}
                      </div>
                      <div>
                        <strong>Correo:</strong> {data?.cliente?.email || "S/N"}
                      </div>
                    </div>
                  </div>

                  {/* Tabla de Productos A4 */}
                  <div className="border border-slate-300 rounded-xl overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
                        <tr>
                          <th className="p-2.5">Código / Cant.</th>
                          <th className="p-2.5">Descripción</th>
                          <th className="p-2.5 text-right">Precio Unitario</th>
                          <th className="p-2.5 text-right">Tarifa IVA</th>
                          <th className="p-2.5 text-right">Precio Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {items.map((it, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-2.5 font-bold">{it.cantidad}</td>
                            <td className="p-2.5">{it.nombre_producto}</td>
                            <td className="p-2.5 text-right">${Number(it.precio_unitario).toFixed(2)}</td>
                            <td className="p-2.5 text-right">{Number(it.sri_tarifa_iva).toFixed(0)}%</td>
                            <td className="p-2.5 text-right font-bold">${Number(it.subtotal).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Sección Inferior: Info Adicional + Totales */}
                  <div className="grid grid-cols-12 gap-6 items-start">
                    <div className="col-span-7 border border-slate-300 rounded-xl p-3.5 space-y-2 bg-slate-50/50">
                      <div className="font-bold text-xs uppercase text-slate-800">
                        Información Adicional & Forma de Pago
                      </div>
                      <div className="text-[11px] space-y-1 text-slate-600">
                        <div><strong>Forma de Pago:</strong> {metodoPago}</div>
                        {data?.venta?.comprobante_transferencia && (
                          <div><strong>N° Comprobante Depósito / Transf.:</strong> {data.venta.comprobante_transferencia}</div>
                        )}
                        <div><strong>Total:</strong> ${total.toFixed(2)}</div>
                        {data?.venta?.metodo_pago === "efectivo" && (
                          <>
                            <div><strong>Monto Recibido:</strong> ${montoRecibido.toFixed(2)}</div>
                            <div><strong>Cambio / Vuelto:</strong> ${vuelto.toFixed(2)}</div>
                          </>
                        )}
                        <div className="pt-2 text-[10px] text-slate-500">
                          Consulte su comprobante electrónico en el portal oficial del SRI con la clave de acceso indicada arriba.
                        </div>
                      </div>
                    </div>

                    <div className="col-span-5 border border-slate-300 rounded-xl overflow-hidden divide-y divide-slate-200 text-xs">
                      <div className="flex justify-between p-2">
                        <span className="font-medium">SUBTOTAL 15%:</span>
                        <span className="font-bold">${subtotal15.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between p-2">
                        <span className="font-medium">SUBTOTAL 0%:</span>
                        <span className="font-bold">${subtotal0.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between p-2">
                        <span className="font-medium">SUBTOTAL SIN IMPUESTOS:</span>
                        <span className="font-bold">${subtotalNeto.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between p-2">
                        <span className="font-medium">IVA 15%:</span>
                        <span className="font-bold">${impuestoTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between p-2.5 bg-slate-100 font-bold text-sm text-slate-900">
                        <span>VALOR TOTAL:</span>
                        <span>${total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pie del Modal */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span>Formato activo:</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">
              {activeTab === "ticket" ? `Ticket Térmico (${config.ticketWidth})` : "Hoja Estándar A4"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition"
            >
              Cerrar
            </button>
            <button
              onClick={() => triggerPrint(activeTab)}
              disabled={loading || !data}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition active:scale-95 disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Ahora</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
