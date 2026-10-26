"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
  BookOpen,
  FolderTree,
  PlusCircle,
  FileText,
  BarChart3,
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  Calendar,
  Layers,
  ArrowRightLeft,
  X,
  Eye,
  Ban,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Info,
  Scale,
  Activity,
  FileCode2,
  FileCheck2,
} from "lucide-react";
import EstadosFinancierosView from "@/components/accounting/EstadosFinancierosView";
import MetricasFinancierasView from "@/components/accounting/MetricasFinancierasView";
import AtsSriView from "@/components/accounting/AtsSriView";
import FacturacionSriView from "@/components/accounting/FacturacionSriView";

interface Cuenta {
  id: number;
  codigo: string;
  nombre: string;
  tipo: "ACTIVO" | "PASIVO" | "PATRIMONIO" | "INGRESOS" | "COSTOS" | "GASTOS";
  naturaleza: "DEUDORA" | "ACREEDORA";
  nivel: number;
  padre_id: number | null;
  padre_nombre?: string | null;
  acepta_movimiento: number;
  es_sistema?: string | null;
  activo: number;
}

interface AsientoLinea {
  cuenta_id: number;
  codigo?: string;
  nombre?: string;
  concepto: string;
  referencia_documento?: string;
  debe: number | string;
  haber: number | string;
}

interface Asiento {
  id: number;
  numero_asiento: number;
  fecha: string;
  tipo_asiento: string;
  concepto: string;
  origen: string;
  origen_id?: number | null;
  total_debe: number;
  total_haber: number;
  estado: "mayorizado" | "anulado" | "borrador";
  asiento_reversion_id?: number | null;
  creado_por: number;
  creador_nombre?: string;
  created_at: string;
  lineas?: any[];
}

interface LedgerAccount {
  cuenta_id: number;
  codigo: string;
  nombre: string;
  tipo: string;
  naturaleza: string;
  total_debe: number;
  total_haber: number;
  saldo_final: number;
  movimientos: {
    asiento_id: number;
    numero_asiento: number;
    fecha: string;
    tipo_asiento: string;
    concepto: string;
    referencia?: string;
    debe: number;
    haber: number;
    saldo: number;
  }[];
}

type ContabilidadTab =
  | "estados_financieros"
  | "diario"
  | "mayor"
  | "plan"
  | "facturacion_sri"
  | "ats_sri"
  | "metricas"
  | "nuevo_asiento";

function ContabilidadView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get("tab") as ContabilidadTab | null;

  const [activeTab, setActiveTab] = useState<ContabilidadTab>(() => {
    if (
      tabFromUrl &&
      [
        "estados_financieros",
        "diario",
        "mayor",
        "plan",
        "facturacion_sri",
        "ats_sri",
        "metricas",
        "nuevo_asiento",
      ].includes(tabFromUrl)
    ) {
      return tabFromUrl;
    }
    return "estados_financieros";
  });

  // Reacciona automáticamente cada vez que el usuario hace clic en los enlaces del Sidebar o URL
  useEffect(() => {
    if (
      tabFromUrl &&
      [
        "estados_financieros",
        "diario",
        "mayor",
        "plan",
        "facturacion_sri",
        "ats_sri",
        "metricas",
        "nuevo_asiento",
      ].includes(tabFromUrl)
    ) {
      if (tabFromUrl !== activeTab) {
        setActiveTab(tabFromUrl);
      }
    } else if (!tabFromUrl && activeTab !== "estados_financieros") {
      setActiveTab("estados_financieros");
    }
  }, [tabFromUrl]);

  // Listener para sincronización directa de clics desde el Sidebar
  useEffect(() => {
    const handleCustomTab = (e: any) => {
      const target = e.detail as ContabilidadTab;
      if (
        target &&
        [
          "estados_financieros",
          "diario",
          "mayor",
          "plan",
          "facturacion_sri",
          "ats_sri",
          "metricas",
          "nuevo_asiento",
        ].includes(target)
      ) {
        setActiveTab(target);
      }
    };
    window.addEventListener("pyme-contabilidad-tab", handleCustomTab);
    return () => {
      window.removeEventListener("pyme-contabilidad-tab", handleCustomTab);
    };
  }, []);

  const handleTabChange = (tab: ContabilidadTab) => {
    setActiveTab(tab);
    router.push(`/dashboard/contabilidad?tab=${tab}`);
    window.dispatchEvent(new CustomEvent("pyme-contabilidad-tab", { detail: tab }));
  };

  // Estado del Plan de Cuentas
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [loadingCuentas, setLoadingCuentas] = useState(false);
  const [searchCuenta, setSearchCuenta] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("TODOS");

  // Modal Nueva Cuenta
  const [modalCuentaOpen, setModalCuentaOpen] = useState(false);
  const [formCuenta, setFormCuenta] = useState({
    codigo: "",
    nombre: "",
    tipo: "ACTIVO",
    naturaleza: "DEUDORA",
    padre_id: "",
    acepta_movimiento: 1,
  });

  // Estado del Nuevo Asiento
  const [fechaAsiento, setFechaAsiento] = useState(new Date().toISOString().split("T")[0]);
  const [tipoAsiento, setTipoAsiento] = useState<"DIARIO" | "INGRESO" | "EGRESO" | "AJUSTE">("DIARIO");
  const [conceptoAsiento, setConceptoAsiento] = useState("");
  const [lineasAsiento, setLineasAsiento] = useState<AsientoLinea[]>([
    { cuenta_id: 0, concepto: "", debe: "", haber: "" },
    { cuenta_id: 0, concepto: "", debe: "", haber: "" },
  ]);
  const [guardandoAsiento, setGuardandoAsiento] = useState(false);

  // Estado del Libro Diario
  const [asientos, setAsientos] = useState<Asiento[]>([]);
  const [loadingDiario, setLoadingDiario] = useState(false);
  const [diarioDesde, setDiarioDesde] = useState("");
  const [diarioHasta, setDiarioHasta] = useState("");

  // Modal Anulación de Asiento
  const [anularModalOpen, setAnularModalOpen] = useState(false);
  const [asientoToAnular, setAsientoToAnular] = useState<Asiento | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState("");
  const [anulando, setAnulando] = useState(false);

  // Estado del Libro Mayor
  const [ledger, setLedger] = useState<LedgerAccount[]>([]);
  const [loadingMayor, setLoadingMayor] = useState(false);
  const [mayorCuentaId, setMayorCuentaId] = useState<string>("");
  const [mayorDesde, setMayorDesde] = useState("");
  const [mayorHasta, setMayorHasta] = useState("");

  // Mensajes de Alerta
  const [feedback, setFeedback] = useState<{ tipo: "success" | "error"; msg: string } | null>(null);

  // Cargar Cuentas
  const loadCuentas = async () => {
    setLoadingCuentas(true);
    try {
      const res = await apiFetch("/tenant/accounting/accounts.php");
      setCuentas(res.cuentas || []);
    } catch (err: any) {
      setFeedback({ tipo: "error", msg: err.message || "Error al cargar plan de cuentas." });
    } finally {
      setLoadingCuentas(false);
    }
  };

  // Cargar Diario
  const loadDiario = async () => {
    setLoadingDiario(true);
    try {
      const params = new URLSearchParams();
      if (diarioDesde) params.append("desde", diarioDesde);
      if (diarioHasta) params.append("hasta", diarioHasta);
      const res = await apiFetch(`/tenant/accounting/journal.php?${params.toString()}`);
      setAsientos(res.asientos || []);
    } catch (err: any) {
      setFeedback({ tipo: "error", msg: err.message || "Error al cargar libro diario." });
    } finally {
      setLoadingDiario(false);
    }
  };

  // Cargar Mayor
  const loadMayor = async () => {
    setLoadingMayor(true);
    try {
      const params = new URLSearchParams();
      if (mayorCuentaId) params.append("cuenta_id", mayorCuentaId);
      if (mayorDesde) params.append("desde", mayorDesde);
      if (mayorHasta) params.append("hasta", mayorHasta);
      const res = await apiFetch(`/tenant/accounting/ledger.php?${params.toString()}`);
      setLedger(res.libro_mayor || []);
    } catch (err: any) {
      setFeedback({ tipo: "error", msg: err.message || "Error al cargar libro mayor." });
    } finally {
      setLoadingMayor(false);
    }
  };

  useEffect(() => {
    loadCuentas();
  }, []);

  useEffect(() => {
    if (activeTab === "diario") loadDiario();
    if (activeTab === "mayor") loadMayor();
  }, [activeTab]);

  // Cuentas con movimiento para selectores de asientos
  const cuentasMovimiento = cuentas.filter((c) => c.acepta_movimiento === 1 && c.activo === 1);

  // Totales de Debe y Haber en Nuevo Asiento
  const totalDebe = lineasAsiento.reduce((acc, l) => acc + (Number(l.debe) || 0), 0);
  const totalHaber = lineasAsiento.reduce((acc, l) => acc + (Number(l.haber) || 0), 0);
  const diferencia = Math.abs(totalDebe - totalHaber);
  const estaCuadrado = diferencia < 0.009 && totalDebe > 0;

  // Manejo de Líneas del Asiento
  const handleAddLinea = () => {
    setLineasAsiento([...lineasAsiento, { cuenta_id: 0, concepto: "", debe: "", haber: "" }]);
  };

  const handleRemoveLinea = (idx: number) => {
    if (lineasAsiento.length <= 2) {
      alert("Un asiento contable requiere al menos 2 líneas para cumplir la partida doble.");
      return;
    }
    setLineasAsiento(lineasAsiento.filter((_, i) => i !== idx));
  };

  const handleUpdateLinea = (idx: number, field: keyof AsientoLinea, val: any) => {
    const updated = [...lineasAsiento];
    updated[idx] = { ...updated[idx], [field]: val };
    setLineasAsiento(updated);
  };

  // Guardar Asiento
  const handleGuardarAsiento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!estaCuadrado) {
      alert(`El asiento contable está descuadrado por $${diferencia.toFixed(2)}. La suma del Debe debe ser exactamente igual a la del Haber.`);
      return;
    }

    setGuardandoAsiento(true);
    setFeedback(null);
    try {
      const res = await apiFetch("/tenant/accounting/journal.php", {
        method: "POST",
        body: JSON.stringify({
          fecha: fechaAsiento,
          tipo_asiento: tipoAsiento,
          concepto: conceptoAsiento,
          detalles: lineasAsiento.map((l) => ({
            cuenta_id: l.cuenta_id,
            concepto: l.concepto || conceptoAsiento,
            referencia_documento: l.referencia_documento,
            debe: Number(l.debe) || 0,
            haber: Number(l.haber) || 0,
          })),
        }),
      });

      setFeedback({ tipo: "success", msg: res.message || "Asiento mayorizado exitosamente." });
      setConceptoAsiento("");
      setLineasAsiento([
        { cuenta_id: 0, concepto: "", debe: "", haber: "" },
        { cuenta_id: 0, concepto: "", debe: "", haber: "" },
      ]);
      handleTabChange("diario");
      loadDiario();
    } catch (err: any) {
      setFeedback({ tipo: "error", msg: err.message || "Error al registrar asiento." });
    } finally {
      setGuardandoAsiento(false);
    }
  };

  // Guardar Nueva Cuenta
  const handleCrearCuenta = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await apiFetch("/tenant/accounting/accounts.php", {
        method: "POST",
        body: JSON.stringify({
          ...formCuenta,
          padre_id: formCuenta.padre_id ? Number(formCuenta.padre_id) : null,
        }),
      });
      setFeedback({ tipo: "success", msg: res.message || "Cuenta creada exitosamente." });
      setModalCuentaOpen(false);
      setFormCuenta({
        codigo: "",
        nombre: "",
        tipo: "ACTIVO",
        naturaleza: "DEUDORA",
        padre_id: "",
        acepta_movimiento: 1,
      });
      loadCuentas();
    } catch (err: any) {
      setFeedback({ tipo: "error", msg: err.message || "Error al crear cuenta." });
    }
  };

  // Anulación Inmutable
  const handleConfirmarAnulacion = async () => {
    if (!asientoToAnular) return;
    setAnulando(true);
    try {
      const res = await apiFetch("/tenant/accounting/journal.php", {
        method: "PATCH",
        body: JSON.stringify({
          asiento_id: asientoToAnular.id,
          motivo: motivoAnulacion || "Anulación manual por corrección de libro",
        }),
      });
      setFeedback({ tipo: "success", msg: res.mensaje || "Asiento anulado por reversión." });
      setAnularModalOpen(false);
      setAsientoToAnular(null);
      setMotivoAnulacion("");
      loadDiario();
    } catch (err: any) {
      setFeedback({ tipo: "error", msg: err.message || "Error al anular asiento." });
    } finally {
      setAnulando(false);
    }
  };

  // Filtrado de cuentas
  const cuentasFiltradas = cuentas.filter((c) => {
    const matchSearch =
      c.codigo.toLowerCase().includes(searchCuenta.toLowerCase()) ||
      c.nombre.toLowerCase().includes(searchCuenta.toLowerCase());
    const matchTipo = filtroTipo === "TODOS" || c.tipo === filtroTipo;
    return matchSearch && matchTipo;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabecera Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              Contabilidad & Libro Diario
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                NIIF Ecuador (Doble Partida)
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Plan de cuentas, registro inmutable de asientos contables y libros mayorizados
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (activeTab === "plan") loadCuentas();
              if (activeTab === "diario") loadDiario();
              if (activeTab === "mayor") loadMayor();
            }}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
            title="Recargar datos"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleTabChange("nuevo_asiento")}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Asiento</span>
          </button>
        </div>
      </div>

      {/* Alerta de Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between border ${
            feedback.tipo === "success"
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
              : "bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.tipo === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.msg}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="font-bold text-xs">
            ✕
          </button>
        </div>
      )}

      {/* Pestañas de Navegación Contable Unificada */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => handleTabChange("estados_financieros")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === "estados_financieros"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Scale className="w-4 h-4 text-emerald-500" />
          <span>Estados Financieros (Balances & P&L)</span>
        </button>

        <button
          onClick={() => handleTabChange("diario")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === "diario"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <FileText className="w-4 h-4 text-indigo-500" />
          <span>Libro Diario</span>
        </button>

        <button
          onClick={() => handleTabChange("mayor")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === "mayor"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <BarChart3 className="w-4 h-4 text-purple-500" />
          <span>Libro Mayor</span>
        </button>

        <button
          onClick={() => handleTabChange("plan")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === "plan"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <FolderTree className="w-4 h-4 text-blue-500" />
          <span>Plan de Cuentas ({cuentas.length})</span>
        </button>

        <button
          onClick={() => handleTabChange("facturacion_sri")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === "facturacion_sri"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <FileCheck2 className="w-4 h-4 text-sky-500" />
          <span>Facturación Electrónica SRI</span>
        </button>

        <button
          onClick={() => handleTabChange("ats_sri")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === "ats_sri"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <FileCode2 className="w-4 h-4 text-amber-500" />
          <span>Anexo ATS SRI</span>
        </button>

        <button
          onClick={() => handleTabChange("metricas")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === "metricas"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Activity className="w-4 h-4 text-rose-500" />
          <span>Ratios & Métricas</span>
        </button>

        <button
          onClick={() => handleTabChange("nuevo_asiento")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === "nuevo_asiento"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <PlusCircle className="w-4 h-4 text-indigo-400" />
          <span>Nuevo Asiento Manual</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* PESTAÑA 1: PLAN DE CUENTAS (ÁRBOL JERÁRQUICO)              */}
      {/* ========================================================= */}
      {activeTab === "plan" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            {/* Buscador */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Buscar por código (ej. 1.1.01) o nombre..."
                className="w-full bg-transparent outline-none text-xs"
                value={searchCuenta}
                onChange={(e) => setSearchCuenta(e.target.value)}
              />
            </div>

            {/* Filtros de Tipo */}
            <div className="flex items-center gap-2 overflow-x-auto">
              {["TODOS", "ACTIVO", "PASIVO", "PATRIMONIO", "INGRESOS", "COSTOS", "GASTOS"].map((t) => (
                <button
                  key={t}
                  onClick={() => setFiltroTipo(t)}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition shrink-0 ${
                    filtroTipo === t
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                  }`}
                >
                  {t}
                </button>
              ))}
              <button
                onClick={() => setModalCuentaOpen(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs shrink-0 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Crear Subcuenta</span>
              </button>
            </div>
          </div>

          {/* Tabla Jerárquica del Plan de Cuentas */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Nombre de la Cuenta</th>
                    <th className="py-3 px-3">Tipo</th>
                    <th className="py-3 px-3">Naturaleza</th>
                    <th className="py-3 px-3">Nivel</th>
                    <th className="py-3 px-3">Movimiento</th>
                    <th className="py-3 px-4">Enlace Sistema</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loadingCuentas ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        Cargando catálogo contable...
                      </td>
                    </tr>
                  ) : cuentasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No se encontraron cuentas contables coincidentes.
                      </td>
                    </tr>
                  ) : (
                    cuentasFiltradas.map((c) => {
                      const indentClass =
                        c.nivel === 1
                          ? "font-extrabold text-sm text-slate-900 dark:text-white"
                          : c.nivel === 2
                          ? "font-bold text-xs pl-6 text-slate-800 dark:text-slate-200"
                          : c.nivel === 3
                          ? "font-medium text-xs pl-10 text-slate-700 dark:text-slate-300"
                          : "text-xs pl-14 text-slate-600 dark:text-slate-400";

                      return (
                        <tr
                          key={c.id}
                          className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition ${
                            c.nivel === 1 ? "bg-slate-50/50 dark:bg-slate-950/20" : ""
                          }`}
                        >
                          <td className="py-2.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {c.codigo}
                          </td>
                          <td className={`py-2.5 px-4 ${indentClass}`}>
                            <div className="flex items-center gap-1.5">
                              {c.nivel > 1 && (
                                <span className="text-slate-300 dark:text-slate-600 font-mono">└─</span>
                              )}
                              <span>{c.nombre}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                c.tipo === "ACTIVO"
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                  : c.tipo === "PASIVO"
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                  : c.tipo === "PATRIMONIO"
                                  ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                                  : c.tipo === "INGRESOS"
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                              }`}
                            >
                              {c.tipo}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-[10px]">
                            {c.naturaleza === "DEUDORA" ? (
                              <span className="text-blue-600 dark:text-blue-400">Deudora (+)</span>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400">Acreedora (-)</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 font-mono text-[10px]">
                            L{c.nivel}
                          </td>
                          <td className="py-2.5 px-3">
                            {c.acepta_movimiento === 1 ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-3 h-3" /> Movimiento
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-medium italic">
                                Título
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-[10px] text-slate-500">
                            {c.es_sistema ? (
                              <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-bold text-indigo-600 dark:text-indigo-300">
                                {c.es_sistema}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 2: NUEVO ASIENTO MANUAL (DOBLE PARTIDA)           */}
      {/* ========================================================= */}
      {activeTab === "nuevo_asiento" && (
        <form onSubmit={handleGuardarAsiento} className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Fecha del Asiento
                </label>
                <input
                  type="date"
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                  value={fechaAsiento}
                  onChange={(e) => setFechaAsiento(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Tipo de Comprobante
                </label>
                <select
                  value={tipoAsiento}
                  onChange={(e: any) => setTipoAsiento(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="DIARIO">DIARIO GENERAL</option>
                  <option value="INGRESO">INGRESO / COBRO DE CAJA</option>
                  <option value="EGRESO">EGRESO / PAGO A PROVEEDOR</option>
                  <option value="AJUSTE">AJUSTE CONTABLE</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Glosa / Concepto General
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Registro de compra de suministros o apertura de caja..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                  value={conceptoAsiento}
                  onChange={(e) => setConceptoAsiento(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Tabla Dinámica de Partidas (Líneas Debe / Haber) */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/50">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-indigo-500" />
                Partidas Contables (Debe y Haber)
              </h2>
              <button
                type="button"
                onClick={handleAddLinea}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar Línea</span>
              </button>
            </div>

            <div className="overflow-x-auto p-4">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-500">
                    <th className="pb-2 w-1/3">Cuenta Contable</th>
                    <th className="pb-2">Glosa Particular</th>
                    <th className="pb-2 w-28">Referencia</th>
                    <th className="pb-2 text-right w-32">Debe ($)</th>
                    <th className="pb-2 text-right w-32">Haber ($)</th>
                    <th className="pb-2 text-center w-12">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {lineasAsiento.map((l, idx) => (
                    <tr key={idx} className="align-middle">
                      <td className="py-2 pr-2">
                        <select
                          required
                          value={l.cuenta_id || ""}
                          onChange={(e) => handleUpdateLinea(idx, "cuenta_id", Number(e.target.value))}
                          className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">-- Seleccionar Cuenta con Movimiento --</option>
                          {cuentasMovimiento.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.codigo} - {c.nombre} ({c.naturaleza === "DEUDORA" ? "Deudora" : "Acreedora"})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          placeholder="Glosa de la línea..."
                          className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                          value={l.concepto}
                          onChange={(e) => handleUpdateLinea(idx, "concepto", e.target.value)}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          placeholder="Doc # / Factura"
                          className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                          value={l.referencia_documento || ""}
                          onChange={(e) => handleUpdateLinea(idx, "referencia_documento", e.target.value)}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs font-mono font-bold text-right outline-none focus:ring-2 focus:ring-indigo-500"
                          value={l.debe}
                          onChange={(e) => {
                            handleUpdateLinea(idx, "debe", e.target.value);
                            if (Number(e.target.value) > 0) handleUpdateLinea(idx, "haber", "");
                          }}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs font-mono font-bold text-right outline-none focus:ring-2 focus:ring-indigo-500"
                          value={l.haber}
                          onChange={(e) => {
                            handleUpdateLinea(idx, "haber", e.target.value);
                            if (Number(e.target.value) > 0) handleUpdateLinea(idx, "debe", "");
                          }}
                        />
                      </td>
                      <td className="py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLinea(idx)}
                          className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 transition"
                          title="Eliminar partida"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Barra de Validación de Partida Doble en Tiempo Real */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="text-xs">
                  <span className="text-slate-500 block">TOTAL DEBE:</span>
                  <span className="font-mono font-extrabold text-sm text-slate-900 dark:text-white">
                    ${totalDebe.toFixed(2)}
                  </span>
                </div>
                <div className="text-xs">
                  <span className="text-slate-500 block">TOTAL HABER:</span>
                  <span className="font-mono font-extrabold text-sm text-slate-900 dark:text-white">
                    ${totalHaber.toFixed(2)}
                  </span>
                </div>
                <div className="text-xs">
                  <span className="text-slate-500 block">DIFERENCIA:</span>
                  <span
                    className={`font-mono font-extrabold text-sm ${
                      diferencia < 0.009 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    ${diferencia.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {estaCuadrado ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    <CheckCircle2 className="w-4 h-4" /> Partida Doble Cuadrada
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-300 dark:border-red-800">
                    <AlertTriangle className="w-4 h-4" /> Asiento Descuadrado
                  </span>
                )}

                <button
                  type="submit"
                  disabled={!estaCuadrado || guardandoAsiento}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-xs shadow-md shadow-indigo-600/20 transition active:scale-95"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{guardandoAsiento ? "Mayorizando..." : "Mayorizar Asiento"}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 3: LIBRO DIARIO (LISTADO Y ANULACIÓN INMUTABLE)     */}
      {/* ========================================================= */}
      {activeTab === "diario" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Desde</label>
                <input
                  type="date"
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-xs"
                  value={diarioDesde}
                  onChange={(e) => setDiarioDesde(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Hasta</label>
                <input
                  type="date"
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-xs"
                  value={diarioHasta}
                  onChange={(e) => setDiarioHasta(e.target.value)}
                />
              </div>
              <button
                onClick={loadDiario}
                className="mt-4 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold"
              >
                Filtrar
              </button>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Total asientos registrados: <strong>{asientos.length}</strong>
            </div>
          </div>

          {loadingDiario ? (
            <div className="p-12 text-center text-slate-400">Cargando libro diario...</div>
          ) : asientos.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              No hay asientos registrados para este período.
            </div>
          ) : (
            <div className="space-y-4">
              {asientos.map((as) => (
                <div
                  key={as.id}
                  className={`bg-white dark:bg-slate-900 rounded-3xl border shadow-sm overflow-hidden transition ${
                    as.estado === "anulado"
                      ? "border-red-200 dark:border-red-950/80 opacity-75"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  {/* Cabecera del Asiento */}
                  <div className="p-4 border-b border-slate-100 dark:divide-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-950/40">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-extrabold text-sm text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2.5 py-1 rounded-xl border border-indigo-200 dark:border-indigo-800">
                        Asiento #{as.numero_asiento}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> {as.fecha}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase">
                        {as.tipo_asiento}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          as.estado === "mayorizado"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                        }`}
                      >
                        {as.estado}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {as.asiento_reversion_id && (
                        <span className="text-[10px] text-red-600 font-bold">
                          (Reversión Asiento ID #{as.asiento_reversion_id})
                        </span>
                      )}
                      {as.estado === "mayorizado" && (
                        <button
                          type="button"
                          onClick={() => {
                            setAsientoToAnular(as);
                            setAnularModalOpen(true);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-red-300 text-red-600 dark:border-red-900 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 text-xs font-bold transition"
                          title="Anular asiento mediante reversión inmutable"
                        >
                          <Ban className="w-3 h-3" />
                          <span>Anular por Reversión</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Glosa */}
                  <div className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-50/20">
                    <span className="text-slate-400 font-normal uppercase text-[10px] mr-1">Concepto:</span>
                    {as.concepto}
                  </div>

                  {/* Detalle de Partidas */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/60 dark:bg-slate-800/40 text-[10px] uppercase font-bold text-slate-500">
                        <tr>
                          <th className="py-2 px-4 w-32">Código</th>
                          <th className="py-2 px-4">Cuenta</th>
                          <th className="py-2 px-4">Detalle / Ref</th>
                          <th className="py-2 px-4 text-right w-32">Debe ($)</th>
                          <th className="py-2 px-4 text-right w-32">Haber ($)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {(as.lineas || []).map((l, lIdx) => (
                          <tr key={lIdx}>
                            <td className="py-2 px-4 font-mono font-bold text-slate-600 dark:text-slate-400">
                              {l.cuenta_codigo}
                            </td>
                            <td className="py-2 px-4 font-medium text-slate-800 dark:text-slate-200">
                              {l.cuenta_nombre}
                            </td>
                            <td className="py-2 px-4 text-slate-500 text-[11px]">
                              {l.concepto} {l.referencia_documento && `• Ref: ${l.referencia_documento}`}
                            </td>
                            <td className="py-2 px-4 text-right font-mono font-bold">
                              {Number(l.debe) > 0 ? `$${Number(l.debe).toFixed(2)}` : "—"}
                            </td>
                            <td className="py-2 px-4 text-right font-mono font-bold">
                              {Number(l.haber) > 0 ? `$${Number(l.haber).toFixed(2)}` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-200 dark:border-slate-800 font-extrabold text-xs bg-slate-50 dark:bg-slate-950/50">
                          <td colSpan={3} className="py-2 px-4 text-right uppercase text-[10px] text-slate-500">
                            Totales Cuadrados:
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-indigo-600 dark:text-indigo-400">
                            ${Number(as.total_debe).toFixed(2)}
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-indigo-600 dark:text-indigo-400">
                            ${Number(as.total_haber).toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 4: LIBRO MAYOR (SALDOS ACUMULADOS)                 */}
      {/* ========================================================= */}
      {activeTab === "mayor" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="flex-1 min-w-[240px]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Filtrar Cuenta</label>
                <select
                  value={mayorCuentaId}
                  onChange={(e) => setMayorCuentaId(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-xs font-semibold outline-none"
                >
                  <option value="">-- Ver Todas las Cuentas con Movimiento --</option>
                  {cuentasMovimiento.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.codigo} - {c.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Desde</label>
                <input
                  type="date"
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-xs"
                  value={mayorDesde}
                  onChange={(e) => setMayorDesde(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Hasta</label>
                <input
                  type="date"
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-xs"
                  value={mayorHasta}
                  onChange={(e) => setMayorHasta(e.target.value)}
                />
              </div>

              <button
                onClick={loadMayor}
                className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
              >
                Consultar Mayor
              </button>
            </div>
          </div>

          {loadingMayor ? (
            <div className="p-12 text-center text-slate-400">Calculando libro mayor...</div>
          ) : ledger.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              No hay movimientos contables mayorizados para los filtros seleccionados.
            </div>
          ) : (
            <div className="space-y-6">
              {ledger.map((lAcc) => (
                <div
                  key={lAcc.cuenta_id}
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
                >
                  {/* Tarjeta de Cuenta Mayor */}
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-black text-sm text-indigo-600 dark:text-indigo-400">
                        {lAcc.codigo}
                      </span>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                        {lAcc.nombre}
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase">
                        {lAcc.naturaleza === "DEUDORA" ? "Naturaleza Deudora" : "Naturaleza Acreedora"}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-slate-400 font-sans block">TOTAL DÉBITOS:</span>
                        <strong className="text-slate-800 dark:text-slate-200">${lAcc.total_debe.toFixed(2)}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-sans block">TOTAL CRÉDITOS:</span>
                        <strong className="text-slate-800 dark:text-slate-200">${lAcc.total_haber.toFixed(2)}</strong>
                      </div>
                      <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800">
                        <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-sans font-bold block">
                          SALDO FINAL:
                        </span>
                        <strong className="text-sm font-extrabold text-indigo-700 dark:text-indigo-300">
                          ${lAcc.saldo_final.toFixed(2)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Tabla de Movimientos del Mayor */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/50 dark:bg-slate-800/30 text-[10px] uppercase font-bold text-slate-500">
                        <tr>
                          <th className="py-2 px-4">Fecha</th>
                          <th className="py-2 px-4">Asiento #</th>
                          <th className="py-2 px-4">Glosa Particular / Concepto</th>
                          <th className="py-2 px-4 text-right w-28">Debe ($)</th>
                          <th className="py-2 px-4 text-right w-28">Haber ($)</th>
                          <th className="py-2 px-4 text-right w-32">Saldo Acumulado ($)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {lAcc.movimientos.map((m, mIdx) => (
                          <tr key={mIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="py-2 px-4 font-mono text-slate-500">{m.fecha}</td>
                            <td className="py-2 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              #{m.numero_asiento}
                            </td>
                            <td className="py-2 px-4 text-slate-700 dark:text-slate-300">
                              {m.concepto} {m.referencia && `(${m.referencia})`}
                            </td>
                            <td className="py-2 px-4 text-right font-mono">
                              {m.debe > 0 ? `$${m.debe.toFixed(2)}` : "—"}
                            </td>
                            <td className="py-2 px-4 text-right font-mono">
                              {m.haber > 0 ? `$${m.haber.toFixed(2)}` : "—"}
                            </td>
                            <td className="py-2 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                              ${m.saldo.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CREAR NUEVA SUBCUENTA EN EL PLAN                    */}
      {/* ========================================================= */}
      {modalCuentaOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl max-w-lg w-full border border-slate-200 dark:border-slate-800 space-y-4 shadow-2xl animate-fade-in text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-indigo-600" />
                Crear Nueva Subcuenta Contable
              </h3>
              <button onClick={() => setModalCuentaOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCrearCuenta} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Código Jerárquico *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 1.1.01.03"
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formCuenta.codigo}
                    onChange={(e) => setFormCuenta({ ...formCuenta, codigo: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Cuenta Padre
                  </label>
                  <select
                    value={formCuenta.padre_id}
                    onChange={(e) => setFormCuenta({ ...formCuenta, padre_id: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Sin Padre (Clase Principal) --</option>
                    {cuentas
                      .filter((c) => c.acepta_movimiento === 0)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.codigo} - {c.nombre}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Nombre de la Cuenta *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Caja Chica Sucursal Norte"
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500"
                  value={formCuenta.nombre}
                  onChange={(e) => setFormCuenta({ ...formCuenta, nombre: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Tipo de Cuenta
                  </label>
                  <select
                    value={formCuenta.tipo}
                    onChange={(e: any) => setFormCuenta({ ...formCuenta, tipo: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ACTIVO">ACTIVO</option>
                    <option value="PASIVO">PASIVO</option>
                    <option value="PATRIMONIO">PATRIMONIO</option>
                    <option value="INGRESOS">INGRESOS</option>
                    <option value="COSTOS">COSTOS</option>
                    <option value="GASTOS">GASTOS</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Naturaleza Contable
                  </label>
                  <select
                    value={formCuenta.naturaleza}
                    onChange={(e: any) => setFormCuenta({ ...formCuenta, naturaleza: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="DEUDORA">DEUDORA (+ Débitos / - Créditos)</option>
                    <option value="ACREEDORA">ACREEDORA (+ Créditos / - Débitos)</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl cursor-pointer border border-slate-200 dark:border-slate-700">
                <input
                  type="checkbox"
                  checked={formCuenta.acepta_movimiento === 1}
                  onChange={(e) => setFormCuenta({ ...formCuenta, acepta_movimiento: e.target.checked ? 1 : 0 })}
                  className="rounded text-indigo-600"
                />
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Esta cuenta acepta movimientos directos (asientos contables)
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalCuentaOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  Guardar Cuenta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 5: ESTADOS FINANCIEROS (BALANCES Y P&L)           */}
      {/* ========================================================= */}
      {activeTab === "estados_financieros" && <EstadosFinancierosView />}

      {/* ========================================================= */}
      {/* PESTAÑA 6: RATIOS & MÉTRICAS FINANCIERAS                  */}
      {/* ========================================================= */}
      {activeTab === "metricas" && <MetricasFinancierasView />}

      {/* ========================================================= */}
      {/* PESTAÑA 7: ANEXO TRANSACCIONAL SIMPLIFICADO (ATS SRI)      */}
      {/* ========================================================= */}
      {activeTab === "ats_sri" && <AtsSriView />}

      {/* ========================================================= */}
      {/* PESTAÑA 8: FACTURACIÓN ELECTRÓNICA & RETENCIONES SRI     */}
      {/* ========================================================= */}
      {activeTab === "facturacion_sri" && <FacturacionSriView />}

      {/* ========================================================= */}
      {/* MODAL: ANULACIÓN DE ASIENTO (PRINCIPIO DE INMUTABILIDAD)   */}
      {/* ========================================================= */}
      {anularModalOpen && asientoToAnular && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl max-w-md w-full border border-red-200 dark:border-red-900/60 space-y-4 shadow-2xl animate-fade-in text-xs">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="p-2.5 rounded-2xl bg-red-100 dark:bg-red-950">
                <Ban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Anular Asiento #{asientoToAnular.numero_asiento}
                </h3>
                <p className="text-[11px] text-slate-500">Principio de Inmutabilidad Contable</p>
              </div>
            </div>

            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Los asientos mayorizados <strong>nunca se eliminan físicamente</strong> de la base de datos. En su lugar, el sistema generará un <strong>asiento de reversión</strong> que invertirá automáticamente los saldos del Debe y el Haber.
            </p>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                Motivo de la Anulación *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Indica el motivo por el cual se revierte esta transacción..."
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent outline-none focus:ring-2 focus:ring-red-500"
                value={motivoAnulacion}
                onChange={(e) => setMotivoAnulacion(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setAnularModalOpen(false);
                  setAsientoToAnular(null);
                }}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={anulando || !motivoAnulacion.trim()}
                onClick={handleConfirmarAnulacion}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold"
              >
                {anulando ? "Generando reversión..." : "Confirmar Anulación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ContabilidadPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
          <p className="text-xs font-semibold">Cargando módulo contable...</p>
        </div>
      }
    >
      <ContabilidadView />
    </Suspense>
  );
}
