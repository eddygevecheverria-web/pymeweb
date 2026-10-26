"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  FileCheck2,
  Save,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Lock,
  Building2,
  ShieldCheck,
  RefreshCw,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  Download,
  Printer,
  RotateCcw,
  Plus,
  ArrowDownLeft,
  Copy,
  Check,
  Receipt,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Info,
  Sliders,
} from "lucide-react";
import { getPrinterConfig, savePrinterConfig, PrinterConfig, DEFAULT_PRINTER_CONFIG } from "@/components/InvoicePrintModal";

interface ComprobanteSRI {
  id: number;
  tipo_documento: "01" | "04" | "07";
  tipo_nombre: string;
  origen_tipo: string;
  origen_id: number;
  serie: string;
  secuencial: number;
  numero_comprobante: string;
  clave_acceso: string;
  fecha_emision: string;
  ambiente: number;
  estado_sri: "AUTORIZADO" | "PENDIENTE" | "RECIBIDA" | "DEVUELTA" | "NO_AUTORIZADO";
  mensaje_sri: string | null;
  numero_autorizacion: string | null;
  fecha_autorizacion: string | null;
  email_enviado: number;
  asiento_id: number | null;
  created_at: string;
}

interface RetencionCliente {
  id: number;
  venta_id: number;
  cliente_id: number;
  cliente_nombre: string;
  cliente_documento: string;
  numero_retencion: string;
  fecha_emision: string;
  retencion_renta: string | number;
  porcentaje_renta: string | number;
  retencion_iva: string | number;
  porcentaje_iva: string | number;
  total_retenido: string | number;
  venta_total: string | number;
  numero_asiento: string | null;
  observaciones: string | null;
  created_at: string;
}

export default function FacturacionSriView() {
  const [activeTab, setActiveTab] = useState<"comprobantes" | "retenciones_clientes" | "configuracion" | "impresion">("comprobantes");

  // Configuración SRI
  const [form, setForm] = useState({
    ruc: "",
    razon_social: "",
    nombre_comercial: "",
    dir_matriz: "",
    dir_establecimiento: "",
    codigo_establecimiento: "001",
    punto_emision: "001",
    tipo_contribuyente: "REGIMEN_GENERAL",
    obligado_contabilidad: "NO",
    contribuyente_especial: "",
    ambiente: 1,
    firma_password: "",
    has_firma: 0,
    has_password: 0,
  });

  const [p12File, setP12File] = useState<File | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [msg, setMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Comprobantes emitidos
  const [token, setToken] = useState<string>("");
  const [comprobantes, setComprobantes] = useState<ComprobanteSRI[]>([]);
  const [loadingComp, setLoadingComp] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<string>("all");
  const [filtroEstado, setFiltroEstado] = useState<string>("all");
  const [busqueda, setBusqueda] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setToken(localStorage.getItem("pymeweb_token") || "");
    }
  }, []);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [retryingClave, setRetryingClave] = useState<string | null>(null);
  const [copiedClave, setCopiedClave] = useState<string | null>(null);

  // Retenciones Recibidas de Clientes
  const [retencionesCli, setRetencionesCli] = useState<RetencionCliente[]>([]);
  const [loadingRetCli, setLoadingRetCli] = useState(false);

  // Configuración de Impresión (Ticket vs A4)
  const [printerConfig, setPrinterConfigState] = useState<PrinterConfig>(DEFAULT_PRINTER_CONFIG);
  const [savingPrinter, setSavingPrinter] = useState(false);

  // Modales
  const [modalNotaCredito, setModalNotaCredito] = useState(false);
  const [modalRetencionProv, setModalRetencionProv] = useState(false);
  const [modalRetencionCli, setModalRetencionCli] = useState(false);

  // Datos para los modales
  const [ventasFacturadas, setVentasFacturadas] = useState<any[]>([]);
  const [comprasRetencion, setComprasRetencion] = useState<any[]>([]);

  // Formulario Modal Nota de Crédito
  const [ncForm, setNcForm] = useState({
    venta_id: 0,
    motivo: "Devolución de mercadería o anulación de factura",
    devolucion_pago: "efectivo",
  });
  const [submittingNC, setSubmittingNC] = useState(false);

  // Formulario Modal Retención Proveedor
  const [retProvForm, setRetProvForm] = useState({
    compra_id: 0,
    ret_renta_porc: 1.75,
    ret_iva_porc: 30.0,
  });
  const [submittingRetProv, setSubmittingRetProv] = useState(false);

  // Formulario Modal Retención Cliente
  const [retCliForm, setRetCliForm] = useState({
    venta_id: 0,
    numero_retencion: "",
    fecha_emision: new Date().toISOString().split("T")[0],
    porcentaje_renta: 1.75,
    retencion_renta: 0.0,
    porcentaje_iva: 30.0,
    retencion_iva: 0.0,
    pago_complementario: 0.0,
    metodo_pago: "efectivo",
    observaciones: "",
  });
  const [submittingRetCli, setSubmittingRetCli] = useState(false);

  // Cargar configuración SRI
  const loadConfig = async () => {
    try {
      setLoadingConfig(true);
      const res = await apiFetch("/tenant/sri-config.php");
      if (res.config) {
        setForm((prev) => ({
          ...prev,
          ...res.config,
          firma_password: "",
          ambiente: Number(res.config.ambiente) || 1,
        }));
      }
      if (res.stats) {
        setStats(res.stats);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingConfig(false);
    }
  };

  // Cargar Comprobantes SRI
  const loadComprobantes = async () => {
    try {
      setLoadingComp(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
        tipo_documento: filtroTipo,
        estado_sri: filtroEstado,
        buscar: busqueda,
      });
      const res = await apiFetch(`/sri/comprobantes.php?${params.toString()}`);
      if (res.success) {
        setComprobantes(res.data || []);
        if (res.pagination) {
          setTotalPages(res.pagination.total_pages || 1);
        }
        if (res.resumen) {
          setStats((prev: any) => ({
            ...prev,
            total_facturas: res.resumen.total_emitidos,
            autorizadas: res.resumen.total_autorizados,
            en_cola: res.resumen.total_pendientes,
            devueltas: res.resumen.total_rechazados,
          }));
        }
      }
    } catch (err: any) {
      console.error("Error al cargar comprobantes:", err);
    } finally {
      setLoadingComp(false);
    }
  };

  // Cargar Retenciones Recibidas
  const loadRetencionesClientes = async () => {
    try {
      setLoadingRetCli(true);
      const res = await apiFetch("/sri/retencion-cliente.php");
      if (res.success) {
        setRetencionesCli(res.data || []);
      }
    } catch (err: any) {
      console.error("Error al cargar retenciones de clientes:", err);
    } finally {
      setLoadingRetCli(false);
    }
  };

  // Cargar impresora guardada
  useEffect(() => {
    setPrinterConfigState(getPrinterConfig());
    loadConfig();
    loadComprobantes();
    loadRetencionesClientes();
  }, []);

  useEffect(() => {
    loadComprobantes();
  }, [page, filtroTipo, filtroEstado]);

  // Reintentar autorización SRI
  const handleRetrySri = async (claveAcceso: string) => {
    try {
      setRetryingClave(claveAcceso);
      const res = await apiFetch("/sri/comprobantes.php?action=retry", {
        method: "POST",
        body: JSON.stringify({ clave_acceso: claveAcceso }),
      });
      if (res.success) {
        setMsg(`¡Comprobante ${claveAcceso.slice(-9)} autorizado con éxito por el SRI!`);
      } else {
        setErrorMsg(res.mensaje || "El SRI aún mantiene el comprobante en proceso.");
      }
      loadComprobantes();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setRetryingClave(null);
    }
  };

  // Copiar Clave de Acceso
  const handleCopyClave = (clave: string) => {
    navigator.clipboard.writeText(clave);
    setCopiedClave(clave);
    setTimeout(() => setCopiedClave(null), 2500);
  };

  // Guardar Configuración SRI
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setMsg("");
    setErrorMsg("");

    const fd = new FormData();
    fd.append("ruc", form.ruc);
    fd.append("razon_social", form.razon_social);
    fd.append("nombre_comercial", form.nombre_comercial);
    fd.append("dir_matriz", form.dir_matriz);
    fd.append("dir_establecimiento", form.dir_establecimiento);
    fd.append("codigo_establecimiento", form.codigo_establecimiento);
    fd.append("punto_emision", form.punto_emision);
    fd.append("tipo_contribuyente", form.tipo_contribuyente);
    fd.append("obligado_contabilidad", form.obligado_contabilidad);
    fd.append("contribuyente_especial", form.contribuyente_especial);
    fd.append("ambiente", String(form.ambiente));
    if (form.firma_password) {
      fd.append("firma_password", form.firma_password);
    }
    if (p12File) {
      fd.append("firma_p12", p12File);
    }

    try {
      const res = await apiFetch("/tenant/sri-config.php", {
        method: "POST",
        body: fd,
      });
      setMsg(res.message);
      setP12File(null);
      loadConfig();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  // Guardar Configuración de Impresión
  const handleSavePrinterConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPrinter(true);
    savePrinterConfig(printerConfig);
    setTimeout(() => {
      setSavingPrinter(false);
      setMsg("Configuración de impresión guardada con éxito.");
    }, 300);
  };

  // Abrir modal de Nota de Crédito
  const handleOpenModalNC = async () => {
    setModalNotaCredito(true);
    try {
      const res = await apiFetch("/sri/comprobantes.php?action=ventas_facturadas");
      if (res.success && res.data) {
        setVentasFacturadas(res.data);
        if (res.data.length > 0) {
          setNcForm((prev) => ({ ...prev, venta_id: res.data[0].id }));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Emitir Nota de Crédito
  const handleEmitirNC = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ncForm.venta_id) {
      setErrorMsg("Debe seleccionar una venta para anular.");
      return;
    }
    setSubmittingNC(true);
    setMsg("");
    setErrorMsg("");

    try {
      const res = await apiFetch("/sri/emitir-nota-credito.php", {
        method: "POST",
        body: JSON.stringify(ncForm),
      });
      if (res.success) {
        setMsg(`¡Nota de Crédito ${res.numero_nota_credito} emitida y autorizada con éxito por el SRI!`);
        setModalNotaCredito(false);
        loadComprobantes();
      } else {
        setErrorMsg(res.mensaje || "Error al emitir la Nota de Crédito.");
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmittingNC(false);
    }
  };

  // Abrir modal de Retención a Proveedor
  const handleOpenModalRetProv = async () => {
    setModalRetencionProv(true);
    try {
      const res = await apiFetch("/sri/comprobantes.php?action=compras_retencion");
      if (res.success && res.data) {
        setComprasRetencion(res.data);
        if (res.data.length > 0) {
          setRetProvForm((prev) => ({ ...prev, compra_id: res.data[0].id }));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Emitir Retención Proveedor
  const handleEmitirRetProv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!retProvForm.compra_id) {
      setErrorMsg("Debe seleccionar una compra a proveedor.");
      return;
    }
    setSubmittingRetProv(true);
    setMsg("");
    setErrorMsg("");

    try {
      const compraSel = comprasRetencion.find((c) => c.id === Number(retProvForm.compra_id));
      const subtotal = compraSel ? Number(compraSel.subtotal) : 0;
      const iva = compraSel ? Number(compraSel.iva) : 0;

      const retenciones = [
        {
          codigo_impuesto: 1, // Renta
          codigo_retencion: "312",
          base_imponible: subtotal,
          porcentaje: retProvForm.ret_renta_porc,
          valor_retenido: Number((subtotal * (retProvForm.ret_renta_porc / 100)).toFixed(2)),
        },
      ];
      if (iva > 0) {
        retenciones.push({
          codigo_impuesto: 2, // IVA
          codigo_retencion: "1",
          base_imponible: iva,
          porcentaje: retProvForm.ret_iva_porc,
          valor_retenido: Number((iva * (retProvForm.ret_iva_porc / 100)).toFixed(2)),
        });
      }

      const res = await apiFetch("/sri/emitir-retencion.php", {
        method: "POST",
        body: JSON.stringify({
          compra_id: retProvForm.compra_id,
          retenciones,
        }),
      });
      if (res.success) {
        setMsg(`¡Comprobante de Retención ${res.numero_comprobante} emitido y autorizado por el SRI!`);
        setModalRetencionProv(false);
        loadComprobantes();
      } else {
        setErrorMsg(res.mensaje || "Error al emitir el comprobante de retención.");
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmittingRetProv(false);
    }
  };

  // Abrir modal de Retención de Cliente
  const handleOpenModalRetCli = async () => {
    setModalRetencionCli(true);
    try {
      const res = await apiFetch("/sri/comprobantes.php?action=ventas_facturadas");
      if (res.success && res.data) {
        setVentasFacturadas(res.data);
        if (res.data.length > 0) {
          const v = res.data[0];
          const sub = Number(v.subtotal);
          const iva = Number(v.impuesto);
          const rRenta = Number((sub * 0.0175).toFixed(2));
          const rIva = Number((iva * 0.3).toFixed(2));
          const pagoComp = Number((Number(v.total) - rRenta - rIva).toFixed(2));

          setRetCliForm({
            venta_id: v.id,
            numero_retencion: "",
            fecha_emision: new Date().toISOString().split("T")[0],
            porcentaje_renta: 1.75,
            retencion_renta: rRenta,
            porcentaje_iva: 30.0,
            retencion_iva: rIva,
            pago_complementario: pagoComp > 0 ? pagoComp : 0.0,
            metodo_pago: "efectivo",
            observaciones: "",
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Cambiar venta seleccionada en Retención Cliente
  const handleSelectVentaRetCli = (vid: number) => {
    const v = ventasFacturadas.find((item) => item.id === vid);
    if (!v) return;
    const sub = Number(v.subtotal);
    const iva = Number(v.impuesto);
    const rRenta = Number((sub * (retCliForm.porcentaje_renta / 100)).toFixed(2));
    const rIva = Number((iva * (retCliForm.porcentaje_iva / 100)).toFixed(2));
    const pagoComp = Number((Number(v.total) - rRenta - rIva).toFixed(2));

    setRetCliForm((prev) => ({
      ...prev,
      venta_id: vid,
      retencion_renta: rRenta,
      retencion_iva: rIva,
      pago_complementario: pagoComp > 0 ? pagoComp : 0.0,
    }));
  };

  // Registrar Retención de Cliente
  const handleRegistrarRetCli = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!retCliForm.venta_id || !retCliForm.numero_retencion) {
      setErrorMsg("Debe especificar la venta y el número de comprobante de retención del cliente.");
      return;
    }
    setSubmittingRetCli(true);
    setMsg("");
    setErrorMsg("");

    try {
      const res = await apiFetch("/sri/retencion-cliente.php", {
        method: "POST",
        body: JSON.stringify(retCliForm),
      });
      if (res.success) {
        setMsg(res.mensaje || "Retención del cliente registrada con éxito.");
        setModalRetencionCli(false);
        loadRetencionesClientes();
      } else {
        setErrorMsg(res.error || "Error al registrar la retención.");
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmittingRetCli(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <FileCheck2 className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Facturación Electrónica SRI (Ecuador)</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gestión normativa de Facturas, Notas de Crédito, Retenciones, Firma XAdES-BES y Libro Diario.
              </p>
            </div>
          </div>
        </div>

        {/* Botones de acción rápida */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleOpenModalNC}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-500/20 text-xs font-bold transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>+ Nota de Crédito</span>
          </button>
          <button
            onClick={handleOpenModalRetProv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 hover:bg-amber-500/20 text-xs font-bold transition"
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>+ Retención Proveedor</span>
          </button>
          <button
            onClick={() => {
              loadComprobantes();
              loadConfig();
              loadRetencionesClientes();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingComp ? "animate-spin" : ""}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Tarjetas de Métricas SRI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs text-slate-400 font-semibold block">Total Emitidos</span>
          <span className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1 block">
            {stats?.total_facturas || 0}
          </span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/20 shadow-sm">
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> Autorizados SRI
          </span>
          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
            {stats?.autorizadas || 0}
          </span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/20 shadow-sm">
          <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> En Proceso / Cola
          </span>
          <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 block">
            {stats?.en_cola || 0}
          </span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/20 shadow-sm">
          <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" /> Devueltos / Rechazados
          </span>
          <span className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1 block">
            {stats?.devueltas || 0}
          </span>
        </div>
      </div>

      {/* Notificaciones */}
      {msg && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 flex items-center gap-3 text-sm animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{msg}</span>
          <button onClick={() => setMsg("")} className="ml-auto text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-center gap-3 text-sm animate-in fade-in">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg("")} className="ml-auto text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Selector de Pestañas (Tabs) */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("comprobantes")}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === "comprobantes"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Comprobantes Emitidos ({stats?.total_facturas || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("retenciones_clientes")}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === "retenciones_clientes"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <ArrowDownLeft className="w-4 h-4" />
          <span>Retenciones de Clientes ({retencionesCli.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("configuracion")}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === "configuracion"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Configuración SRI & Firma .p12</span>
        </button>

        <button
          onClick={() => setActiveTab("impresion")}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === "impresion"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Printer className="w-4 h-4" />
          <span>Impresora (Ticket vs A4)</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: COMPROBANTES EMITIDOS */}
      {/* ========================================================================= */}
      {activeTab === "comprobantes" && (
        <div className="space-y-4">
          {/* Barra de Filtros y Búsqueda */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2 flex-1 min-w-[260px]">
              <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por Clave de Acceso o Comprobante..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadComprobantes()}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filtroTipo}
                onChange={(e) => {
                  setFiltroTipo(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-medium"
              >
                <option value="all">Todos los Tipos</option>
                <option value="01">Facturas (01)</option>
                <option value="04">Notas de Crédito (04)</option>
                <option value="07">Retenciones (07)</option>
              </select>

              <select
                value={filtroEstado}
                onChange={(e) => {
                  setFiltroEstado(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-medium"
              >
                <option value="all">Todos los Estados</option>
                <option value="AUTORIZADO">Autorizados</option>
                <option value="PENDIENTE">Pendientes / Cola</option>
                <option value="DEVUELTA">Devueltos</option>
                <option value="NO_AUTORIZADO">No Autorizados</option>
              </select>
            </div>
          </div>

          {/* Tabla de Comprobantes */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-bold">Tipo</th>
                    <th className="py-3 px-4 font-bold">N° Comprobante</th>
                    <th className="py-3 px-4 font-bold">Clave de Acceso SRI</th>
                    <th className="py-3 px-4 font-bold">Fecha Emisión</th>
                    <th className="py-3 px-4 font-bold">Estado SRI</th>
                    <th className="py-3 px-4 font-bold">Asiento</th>
                    <th className="py-3 px-4 font-bold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loadingComp ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                        <span>Cargando comprobantes electrónicos...</span>
                      </td>
                    </tr>
                  ) : comprobantes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <span>No se encontraron comprobantes electrónicos emitidos.</span>
                      </td>
                    </tr>
                  ) : (
                    comprobantes.map((c) => {
                      const tipoBadge =
                        c.tipo_documento === "01"
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400 border-blue-200"
                          : c.tipo_documento === "04"
                          ? "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400 border-rose-200"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-amber-200";

                      return (
                        <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                          <td className="py-3 px-4">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold border text-[10px] ${tipoBadge}`}>
                              {c.tipo_nombre} ({c.tipo_documento})
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-100">
                            {c.numero_comprobante}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
                              <span>{c.clave_acceso.slice(0, 10)}...{c.clave_acceso.slice(-6)}</span>
                              <button
                                onClick={() => handleCopyClave(c.clave_acceso)}
                                title="Copiar clave completa"
                                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 transition"
                              >
                                {copiedClave === c.clave_acceso ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                            {c.fecha_emision}
                          </td>
                          <td className="py-3 px-4">
                            {c.estado_sri === "AUTORIZADO" ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md">
                                <CheckCircle className="w-3 h-3" /> AUTORIZADO
                              </span>
                            ) : c.estado_sri === "PENDIENTE" || c.estado_sri === "RECIBIDA" ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/80 px-2 py-0.5 rounded-md">
                                <Clock className="w-3 h-3" /> PENDIENTE
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/80 px-2 py-0.5 rounded-md" title={c.mensaje_sri || ""}>
                                <XCircle className="w-3 h-3" /> {c.estado_sri}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {c.asiento_id ? (
                              <span className="inline-block px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[10px] rounded">
                                #{c.asiento_id}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              {/* Descargar RIDE PDF */}
                              <a
                                href={`http://localhost/pymeweb/backend-api/api/sri/comprobantes.php?action=download_pdf&clave_acceso=${c.clave_acceso}&token=${token}`}
                                target="_blank"
                                rel="noreferrer"
                                title="Ver / Descargar RIDE PDF"
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                              >
                                <Printer className="w-3.5 h-3.5 text-indigo-500" />
                              </a>

                              {/* Descargar XML */}
                              <a
                                href={`http://localhost/pymeweb/backend-api/api/sri/comprobantes.php?action=download_xml&clave_acceso=${c.clave_acceso}&token=${token}`}
                                download={`${c.numero_comprobante}.xml`}
                                title="Descargar XML Normativo"
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                              >
                                <Download className="w-3.5 h-3.5 text-emerald-500" />
                              </a>

                              {/* Reintentar si está pendiente o devuelta */}
                              {c.estado_sri !== "AUTORIZADO" && (
                                <button
                                  onClick={() => handleRetrySri(c.clave_acceso)}
                                  disabled={retryingClave === c.clave_acceso}
                                  title="Reintentar autorización en el Web Service del SRI"
                                  className="p-1.5 rounded-lg border border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/60 text-amber-600 dark:text-amber-400 transition"
                                >
                                  <RefreshCw className={`w-3.5 h-3.5 ${retryingClave === c.clave_acceso ? "animate-spin" : ""}`} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span>Página {page} de {totalPages}</span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    className="p-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                    className="p-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: RETENCIONES RECIBIDAS DE CLIENTES */}
      {/* ========================================================================= */}
      {activeTab === "retenciones_clientes" && (
        <div className="space-y-4">
          <div className="bg-indigo-50 dark:bg-indigo-950/40 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-700 dark:text-indigo-300 flex items-start gap-3">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong>Gestión de Retenciones Entrantes (Ecuador):</strong> Cuando un cliente es Agente de Retención SRI o Entidad Pública, te entregará un comprobante de retención. Registra ese comprobante aquí para que el sistema alimente automáticamente tu cuenta de <em>Anticipo de Impuestos</em> (Activo) y liquide el saldo pendiente del cliente en <em>Cuentas por Cobrar</em>, cuadrando el asiento de doble partida.
            </div>
            <button
              onClick={handleOpenModalRetCli}
              className="ml-auto shrink-0 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition"
            >
              + Registrar Retención
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-bold">Fecha</th>
                    <th className="py-3 px-4 font-bold">Cliente</th>
                    <th className="py-3 px-4 font-bold">N° Retención</th>
                    <th className="py-3 px-4 font-bold">Ret. Renta (IR)</th>
                    <th className="py-3 px-4 font-bold">Ret. IVA</th>
                    <th className="py-3 px-4 font-bold">Total Retenido</th>
                    <th className="py-3 px-4 font-bold">Asiento Contable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loadingRetCli ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                        <span>Cargando retenciones recibidas...</span>
                      </td>
                    </tr>
                  ) : retencionesCli.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <span>No hay comprobantes de retención de clientes registrados.</span>
                      </td>
                    </tr>
                  ) : (
                    retencionesCli.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{r.fecha_emision}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-800 dark:text-slate-100 block">{r.cliente_nombre}</span>
                          <span className="text-[11px] text-slate-400 font-mono">{r.cliente_documento}</span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {r.numero_retencion}
                        </td>
                        <td className="py-3 px-4">
                          ${Number(r.retencion_renta).toFixed(2)} ({r.porcentaje_renta}%)
                        </td>
                        <td className="py-3 px-4">
                          ${Number(r.retencion_iva).toFixed(2)} ({r.porcentaje_iva}%)
                        </td>
                        <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                          ${Number(r.total_retenido).toFixed(2)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-0.5 bg-slate-100 dark:bg-slate-800 font-mono text-[10px] rounded text-slate-600 dark:text-slate-300">
                            {r.numero_asiento || `Asiento #${r.id}`}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CONFIGURACIÓN SRI & FIRMA .P12 */}
      {/* ========================================================================= */}
      {activeTab === "configuracion" && (
        <form onSubmit={handleSaveConfig} className="space-y-6">
          {/* Switch de Ambiente */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <span>Ambiente del SRI Ecuador</span>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      form.ambiente === 2
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                    }`}
                  >
                    {form.ambiente === 2 ? "Producción Activa" : "Modo Pruebas"}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {form.ambiente === 2
                    ? "Tus comprobantes tendrán plena validez tributaria legal ante el SRI."
                    : "Ambiente de pruebas (celcer.sri.gob.ec). Ideal para validar tu firma y correlativos sin impacto tributario."}
                </p>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl shrink-0">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, ambiente: 1 })}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    form.ambiente === 1
                      ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  1. Pruebas
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, ambiente: 2 })}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    form.ambiente === 2
                      ? "bg-rose-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  2. Producción
                </button>
              </div>
            </div>
          </div>

          {/* Datos Tributarios */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="font-bold text-base">Datos Tributarios del Emisor (RUC)</h2>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  RUC (13 dígitos) *
                </label>
                <input
                  type="text"
                  maxLength={13}
                  value={form.ruc}
                  onChange={(e) => setForm({ ...form, ruc: e.target.value })}
                  placeholder="1790011122001"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Régimen Tributario
                </label>
                <select
                  value={form.tipo_contribuyente}
                  onChange={(e) => setForm({ ...form, tipo_contribuyente: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
                >
                  <option value="REGIMEN_GENERAL">Régimen General</option>
                  <option value="RIMPE_EMPRENDEDOR">Régimen RIMPE - Emprendedor</option>
                  <option value="RIMPE_NEGOCIO_POPULAR">Régimen RIMPE - Negocio Popular</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Razón Social *
                </label>
                <input
                  type="text"
                  value={form.razon_social}
                  onChange={(e) => setForm({ ...form, razon_social: e.target.value })}
                  placeholder="MI EMPRESA S.A."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Nombre Comercial
                </label>
                <input
                  type="text"
                  value={form.nombre_comercial}
                  onChange={(e) => setForm({ ...form, nombre_comercial: e.target.value })}
                  placeholder="COMERCIAL MI EMPRESA"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Dirección Matriz *
                </label>
                <input
                  type="text"
                  value={form.dir_matriz}
                  onChange={(e) => setForm({ ...form, dir_matriz: e.target.value })}
                  placeholder="Av. Amazonas y Colón, Quito"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Dirección Sucursal / Establecimiento
                </label>
                <input
                  type="text"
                  value={form.dir_establecimiento}
                  onChange={(e) => setForm({ ...form, dir_establecimiento: e.target.value })}
                  placeholder="Local 12, Planta Baja"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Establecimiento
                </label>
                <input
                  type="text"
                  maxLength={3}
                  value={form.codigo_establecimiento}
                  onChange={(e) => setForm({ ...form, codigo_establecimiento: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm font-mono text-center"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Punto Emisión
                </label>
                <input
                  type="text"
                  maxLength={3}
                  value={form.punto_emision}
                  onChange={(e) => setForm({ ...form, punto_emision: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm font-mono text-center"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Obligado Contabilidad
                </label>
                <select
                  value={form.obligado_contabilidad}
                  onChange={(e) => setForm({ ...form, obligado_contabilidad: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm text-center"
                >
                  <option value="NO">NO</option>
                  <option value="SI">SÍ</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  N° Contribuyente Especial
                </label>
                <input
                  type="text"
                  placeholder="Resolución (opcional)"
                  value={form.contribuyente_especial || ""}
                  onChange={(e) => setForm({ ...form, contribuyente_especial: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm font-mono text-center"
                />
              </div>
            </div>
          </div>

          {/* Firma Electrónica (.p12) */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="font-bold text-base">Firma Electrónica (.p12 o .pfx)</h2>
              </div>
              {form.has_firma ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/80 px-2.5 py-1 rounded-full">
                  <ShieldCheck className="w-3.5 h-3.5" /> Firma Cargada y Protegida
                </span>
              ) : (
                <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/80 px-2.5 py-1 rounded-full">
                  Sin Firma Digital
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Tu archivo <code>.p12</code> se custodia de forma aislada en el servidor y su contraseña se resguarda con cifrado militar <strong>AES-256</strong>. Se utiliza exclusivamente en memoria para firmar los comprobantes con el estándar <strong>XAdES-BES</strong>.
            </p>

            <div className="grid sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Archivo de Firma (.p12 o .pfx)
                </label>
                <label className="flex items-center justify-center gap-2 p-3.5 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 cursor-pointer bg-slate-50/50 dark:bg-slate-800/40 transition">
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">
                    {p12File ? p12File.name : form.has_firma ? "Reemplazar firma .p12" : "Seleccionar archivo .p12"}
                  </span>
                  <input
                    type="file"
                    accept=".p12,.pfx"
                    className="hidden"
                    onChange={(e) => setP12File(e.target.files?.[0] || null)}
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Contraseña de la Firma Digital
                </label>
                <input
                  type="password"
                  placeholder={form.has_password ? "•••••••••••• (Guardada con AES-256)" : "Ingresa la clave del .p12"}
                  value={form.firma_password}
                  onChange={(e) => setForm({ ...form, firma_password: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              disabled={savingConfig}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {savingConfig ? "Guardando configuración..." : "Guardar Configuración SRI"}
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: CONFIGURACIÓN DE IMPRESORA (TICKET VS A4) */}
      {/* ========================================================================= */}
      {activeTab === "impresion" && (
        <form onSubmit={handleSavePrinterConfig} className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Printer className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="font-bold text-base">Tipo de Impresión Predeterminada para Facturas y RIDE</h2>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Configura el formato por defecto al imprimir comprobantes desde el Punto de Venta (POS) y desde el módulo de Facturación. Puedes cambiarlo en cualquier momento.
            </p>

            <div className="grid sm:grid-cols-2 gap-4 pt-2">
              {/* Opción 1: Ticket Térmico */}
              <div
                onClick={() => setPrinterConfigState({ ...printerConfig, type: "ticket" })}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between ${
                  printerConfig.type === "ticket"
                    ? "border-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/20"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <Receipt className="w-6 h-6" />
                    </span>
                    {printerConfig.type === "ticket" && (
                      <span className="p-1 rounded-full bg-indigo-600 text-white">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-sm">Impresora de Ticket Térmico (POS)</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Formato continuo para impresoras térmicas de 80mm o 58mm. Optimizado para ventas rápidas en mostrador y minimarkets.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-500">Ancho de papel:</span>
                  <select
                    value={printerConfig.ticketWidth}
                    onChange={(e) =>
                      setPrinterConfigState({
                        ...printerConfig,
                        ticketWidth: e.target.value as "80mm" | "58mm",
                      })
                    }
                    className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="80mm">80mm (Estándar)</option>
                    <option value="58mm">58mm (Portátil)</option>
                  </select>
                </div>
              </div>

              {/* Opción 2: Formato Normal A4 */}
              <div
                onClick={() => setPrinterConfigState({ ...printerConfig, type: "normal" })}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between ${
                  printerConfig.type === "normal"
                    ? "border-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/20"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      <FileText className="w-6 h-6" />
                    </span>
                    {printerConfig.type === "normal" && (
                      <span className="p-1 rounded-full bg-indigo-600 text-white">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-sm">Impresora Normal / Formato A4 (RIDE)</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Formato estándar en hoja carta o A4 con tabla de impuestos desglosada, cuadro tributario del SRI y código de barras. Ideal para oficinas, distribución y facturas a crédito.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    ✓ RIDE normativo oficial del SRI
                  </span>
                </div>
              </div>
            </div>

            {/* Checkbox Auto-impresión */}
            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={printerConfig.autoPrint}
                  onChange={(e) =>
                    setPrinterConfigState({ ...printerConfig, autoPrint: e.target.checked })
                  }
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Abrir cuadro de diálogo de impresión automáticamente al cerrar una venta en el POS
                </span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={savingPrinter}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition shadow-lg shadow-indigo-600/20"
            >
              <Save className="w-4 h-4" />
              {savingPrinter ? "Guardando..." : "Guardar Preferencia de Impresora"}
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EMITIR NOTA DE CRÉDITO ('04') */}
      {/* ========================================================================= */}
      {modalNotaCredito && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <RotateCcw className="w-5 h-5" />
                <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">
                  Emitir Nota de Crédito SRI (Anulación / Devolución)
                </h3>
              </div>
              <button
                onClick={() => setModalNotaCredito(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEmitirNC} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Seleccionar Factura / Venta a Modificar *
                </label>
                {ventasFacturadas.length === 0 ? (
                  <p className="text-slate-400 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    No hay ventas recientes activas para anular.
                  </p>
                ) : (
                  <select
                    value={ncForm.venta_id}
                    onChange={(e) => setNcForm({ ...ncForm, venta_id: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent"
                    required
                  >
                    {ventasFacturadas.map((v) => (
                      <option key={v.id} value={v.id}>
                        Venta #{v.id} - {v.numero_comprobante || "S/F"} - {v.cliente_nombre} (${Number(v.total).toFixed(2)}) - {v.created_at}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Motivo de Modificación (SRI) *
                </label>
                <input
                  type="text"
                  value={ncForm.motivo}
                  onChange={(e) => setNcForm({ ...ncForm, motivo: e.target.value })}
                  placeholder="Ej: Devolución total por producto defectuoso"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Medio de Reembolso / Compensación
                </label>
                <select
                  value={ncForm.devolucion_pago}
                  onChange={(e) => setNcForm({ ...ncForm, devolucion_pago: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent"
                >
                  <option value="efectivo">Efectivo (Caja General)</option>
                  <option value="transferencia">Transferencia Bancaria (Bancos)</option>
                  <option value="cxc">Disminuir Saldo Deudor del Cliente (Cuentas por Cobrar)</option>
                </select>
              </div>

              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 space-y-1">
                <span className="font-bold block">Efectos Automáticos del Sistema:</span>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Genera y firma digitalmente el XML de la Nota de Crédito ante el SRI.</li>
                  <li>Reingresa automáticamente las unidades devueltas al inventario.</li>
                  <li>Dispara el Asiento Contable de reversión en el Libro Diario (Partida Doble).</li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalNotaCredito(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingNC || ventasFacturadas.length === 0}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition disabled:opacity-50"
                >
                  {submittingNC ? "Emitiendo Nota de Crédito..." : "Emitir Nota de Crédito SRI"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EMITIR RETENCIÓN A PROVEEDOR ('07') */}
      {/* ========================================================================= */}
      {modalRetencionProv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <ArrowDownLeft className="w-5 h-5" />
                <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">
                  Emitir Comprobante de Retención a Proveedor
                </h3>
              </div>
              <button
                onClick={() => setModalRetencionProv(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEmitirRetProv} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Seleccionar Compra de Mercadería / Proveedor *
                </label>
                {comprasRetencion.length === 0 ? (
                  <p className="text-slate-400 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    No hay compras recientes registradas a proveedores.
                  </p>
                ) : (
                  <select
                    value={retProvForm.compra_id}
                    onChange={(e) => setRetProvForm({ ...retProvForm, compra_id: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent"
                    required
                  >
                    {comprasRetencion.map((c) => (
                      <option key={c.id} value={c.id}>
                        Compra #{c.id} - Fac: {c.numero_factura} - {c.proveedor_nombre} (${Number(c.total).toFixed(2)})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    % Retención Renta (IR)
                  </label>
                  <select
                    value={retProvForm.ret_renta_porc}
                    onChange={(e) => setRetProvForm({ ...retProvForm, ret_renta_porc: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent"
                  >
                    <option value={1.75}>1.75% (Transferencia bienes muebles)</option>
                    <option value={2.75}>2.75% (Servicios profesionales / RIMPE)</option>
                    <option value={8.0}>8.00% (Honorarios profesionales)</option>
                    <option value={0.0}>0.00% (Sin retención de Renta)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    % Retención IVA
                  </label>
                  <select
                    value={retProvForm.ret_iva_porc}
                    onChange={(e) => setRetProvForm({ ...retProvForm, ret_iva_porc: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent"
                  >
                    <option value={30.0}>30% (Retención IVA Bienes)</option>
                    <option value={70.0}>70% (Retención IVA Servicios)</option>
                    <option value={100.0}>100% (Retención IVA Liquidaciones)</option>
                    <option value={0.0}>0% (Sin retención de IVA)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalRetencionProv(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingRetProv || comprasRetencion.length === 0}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition disabled:opacity-50"
                >
                  {submittingRetProv ? "Emitiendo Retención..." : "Emitir Comprobante Retención SRI"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REGISTRAR RETENCIÓN RECIBIDA DE CLIENTE */}
      {/* ========================================================================= */}
      {modalRetencionCli && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <ArrowDownLeft className="w-5 h-5" />
                <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">
                  Registrar Retención Recibida de Cliente
                </h3>
              </div>
              <button
                onClick={() => setModalRetencionCli(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegistrarRetCli} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Venta Asociada del Cliente *
                </label>
                <select
                  value={retCliForm.venta_id}
                  onChange={(e) => handleSelectVentaRetCli(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent"
                  required
                >
                  {ventasFacturadas.map((v) => (
                    <option key={v.id} value={v.id}>
                      Venta #{v.id} - {v.cliente_nombre} - Total: ${Number(v.total).toFixed(2)} ({v.created_at})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    N° Comprobante Retención Cliente *
                  </label>
                  <input
                    type="text"
                    placeholder="001-002-000012345"
                    value={retCliForm.numero_retencion}
                    onChange={(e) => setRetCliForm({ ...retCliForm, numero_retencion: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Fecha de Emisión *
                  </label>
                  <input
                    type="date"
                    value={retCliForm.fecha_emision}
                    onChange={(e) => setRetCliForm({ ...retCliForm, fecha_emision: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Retención Renta IR ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={retCliForm.retencion_renta}
                    onChange={(e) =>
                      setRetCliForm({ ...retCliForm, retencion_renta: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent font-bold text-indigo-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Retención IVA ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={retCliForm.retencion_iva}
                    onChange={(e) =>
                      setRetCliForm({ ...retCliForm, retencion_iva: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent font-bold text-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Pago Complementario Recibido en Caja/Bancos ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={retCliForm.pago_complementario}
                  onChange={(e) =>
                    setRetCliForm({ ...retCliForm, pago_complementario: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalRetencionCli(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingRetCli || ventasFacturadas.length === 0}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition disabled:opacity-50"
                >
                  {submittingRetCli ? "Guardando..." : "Registrar y Cuadrar Asiento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
