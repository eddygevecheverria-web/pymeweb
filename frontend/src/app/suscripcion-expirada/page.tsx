"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  MessageCircle,
  ArrowLeft,
  Building2,
  Copy,
  Check,
  CreditCard,
  Upload,
  CheckCircle2,
  Sparkles,
  Loader2,
  FileText,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { apiFetch } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost/pymeweb/backend-api/api";

export default function SuscripcionExpiradaPage() {
  const [info, setInfo] = useState<{ negocio_nombre?: string; fecha_expiracion?: string }>({});
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [subscriptionInfo, setSubscriptionInfo] = useState<{
    planes: {
      mensual: { tipo: string; nombre: string; dias: number; precio: number; descripcion: string };
      anual: { tipo: string; nombre: string; dias: number; precio: number; descripcion: string };
    };
    dias_prueba: number;
    datos_bancarios: string;
    whatsapp_soporte: string;
  }>({
    planes: {
      mensual: { tipo: "mensual", nombre: "Plan Mensual", dias: 30, precio: 15, descripcion: "Acceso por 30 días" },
      anual: { tipo: "anual", nombre: "Paquete Anual (1 Año)", dias: 365, precio: 130, descripcion: "Acceso por 365 días" },
    },
    dias_prueba: 7,
    datos_bancarios: "Banco Pichincha - Cta Corriente # 2100458921\nTitular: PymeWeb ERP S.A.S.\nRUC: 1793148921001",
    whatsapp_soporte: "0985559516",
  });

  const [copiedBank, setCopiedBank] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // Formulario de reporte de pago
  const [planSeleccionado, setPlanSeleccionado] = useState<"mensual" | "anual">("mensual");
  const [bancoOrigen, setBancoOrigen] = useState("Banco Pichincha");
  const [numeroComprobante, setNumeroComprobante] = useState("");
  const [fechaTransferencia, setFechaTransferencia] = useState(new Date().toISOString().slice(0, 10));
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [whatsappNotifyUrl, setWhatsappNotifyUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem("pymeweb_expired_info");
    if (raw) {
      try {
        setInfo(JSON.parse(raw));
      } catch (_) {}
    }

    // Cargar precios y cuentas bancarias oficiales configuradas por el superadmin
    fetch(`${API_BASE}/public/subscription-info.php`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.planes) {
          setSubscriptionInfo(data);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoadingConfig(false));
  }, []);

  const handleCopyBank = () => {
    navigator.clipboard.writeText(subscriptionInfo.datos_bancarios);
    setCopiedBank(true);
    setTimeout(() => setCopiedBank(false), 2000);
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const formData = new FormData();
      formData.append("plan_tipo", planSeleccionado);
      formData.append("banco_origen", bancoOrigen);
      formData.append("numero_comprobante", numeroComprobante.trim());
      formData.append("fecha_transferencia", fechaTransferencia);
      if (comprobanteFile) {
        formData.append("comprobante", comprobanteFile);
      }

      const res = await apiFetch<any>("/tenant/subscription.php", {
        method: "POST",
        body: formData,
      });

      if (res.success) {
        setSuccessMsg(res.message);
        setWhatsappNotifyUrl(res.whatsapp_url || null);
        setNumeroComprobante("");
        setComprobanteFile(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error al registrar el comprobante de transferencia.");
    } finally {
      setSubmitting(false);
    }
  };

  const whatsappSoporteClean = subscriptionInfo.whatsapp_soporte.replace(/\D/g, "");
  const whatsappUrlGeneral = `https://wa.me/${
    whatsappSoporteClean.startsWith("09") && whatsappSoporteClean.length === 10
      ? "593" + whatsappSoporteClean.substring(1)
      : whatsappSoporteClean || "593985559516"
  }?text=${encodeURIComponent(
    `Hola, deseo renovar la suscripción de mi negocio "${info.negocio_nombre || "PymeWeb"}" por transferencia bancaria.`
  )}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4">
      <div className="fixed top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="max-w-2xl w-full bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl shadow-2xl border border-amber-300 dark:border-amber-800/80 text-center space-y-6 my-8">
        <div className="mx-auto w-16 h-16 rounded-3xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-md shadow-amber-500/20">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
            Suscripción o Periodo de Prueba Finalizado
          </span>
          <h1 className="text-2xl md:text-3xl font-black pt-2 text-slate-900 dark:text-white">
            {info.negocio_nombre
              ? `El periodo de acceso de "${info.negocio_nombre}" ha expirado`
              : "Tu periodo de acceso ha finalizado"}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-xs md:text-sm max-w-lg mx-auto">
            Tus productos, inventario, ventas y clientes están <strong>100% seguros y respaldados</strong>. Renueva tu acceso mediante transferencia bancaria para reactivar tu Punto de Venta y Tienda Online.
          </p>
          {info.fecha_expiracion && (
            <p className="text-xs text-slate-400 font-mono">
              Fecha de expiración registrada: {info.fecha_expiracion}
            </p>
          )}
        </div>

        {/* PLANES CONFIGURADOS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
          {/* Plan Mensual */}
          <div
            onClick={() => setPlanSeleccionado("mensual")}
            className={`cursor-pointer p-5 rounded-2xl border transition relative ${
              planSeleccionado === "mensual"
                ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-indigo-600"
                : "border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase text-slate-500">Plan Mensual</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                +30 Días
              </span>
            </div>
            <div className="flex items-baseline gap-1 my-2">
              <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                ${subscriptionInfo.planes.mensual.precio.toFixed(2)}
              </span>
              <span className="text-xs text-slate-500">/ mes</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Ideal para negocios que prefieren pagar mes a mes sin compromisos.
            </p>
          </div>

          {/* Paquete Anual */}
          <div
            onClick={() => setPlanSeleccionado("anual")}
            className={`cursor-pointer p-5 rounded-2xl border transition relative ${
              planSeleccionado === "anual"
                ? "border-purple-600 bg-purple-50/50 dark:bg-purple-950/30 ring-2 ring-purple-600"
                : "border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850"
            }`}
          >
            <div className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-900 shadow-sm flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Ahorro Especial
            </div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase text-purple-600">Paquete Anual</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                +365 Días (1 Año)
              </span>
            </div>
            <div className="flex items-baseline gap-1 my-2">
              <span className="text-3xl font-black text-purple-600 dark:text-purple-400">
                ${subscriptionInfo.planes.anual.precio.toFixed(2)}
              </span>
              <span className="text-xs text-slate-500">/ año</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Acceso ininterrumpido durante 1 año completo al ERP con soporte preferencial.
            </p>
          </div>
        </div>

        {/* DATOS BANCARIOS OFICIALES */}
        <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-left space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>Cuentas Bancarias para Transferencias:</span>
            </span>
            <button
              type="button"
              onClick={handleCopyBank}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-bold"
            >
              {copiedBank ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedBank ? "¡Copiado!" : "Copiar Cuentas"}</span>
            </button>
          </div>
          <p className="text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
            {subscriptionInfo.datos_bancarios}
          </p>
        </div>

        {/* BOTONES DE ACCIÓN: REPORTAR TRANSFERENCIA O CONTACTAR WHATSAPP */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={() => setShowReportModal(true)}
            className="w-full py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition active:scale-95"
          >
            <CreditCard className="w-4 h-4" />
            <span>Subir / Reportar Comprobante de Transferencia</span>
          </button>

          <a
            href={whatsappUrlGeneral}
            target="_blank"
            rel="noreferrer"
            className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Contactar Soporte por WhatsApp</span>
          </a>
        </div>

        <div className="pt-2">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            <ArrowLeft className="w-4 h-4" /> Volver a la pantalla de inicio de sesión
          </Link>
        </div>
      </div>

      {/* MODAL PARA SUBIR Y REPORTAR COMPROBANTE DE TRANSFERENCIA */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    Reportar Pago por Transferencia
                  </h3>
                  <span className="text-[11px] text-slate-500">PymeWeb ERP Suscripción</span>
                </div>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 font-bold"
              >
                ✕
              </button>
            </div>

            {successMsg ? (
              <div className="space-y-4 py-4 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-base font-black text-slate-900 dark:text-white">
                  ¡Comprobante Registrado con Éxito!
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {successMsg}
                </p>
                {whatsappNotifyUrl && (
                  <a
                    href={whatsappNotifyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Avisar al Administrador por WhatsApp Ahora</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <form onSubmit={handleReportSubmit} className="space-y-3.5 text-xs text-left">
                {errorMsg && (
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 text-red-600 text-xs font-bold">
                    {errorMsg}
                  </div>
                )}

                <div>
                  <label className="block font-bold mb-1">Plan a Renovar *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPlanSeleccionado("mensual")}
                      className={`p-3 rounded-xl border font-bold text-left transition ${
                        planSeleccionado === "mensual"
                          ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-600"
                          : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      <div className="text-xs font-black">Plan Mensual</div>
                      <div className="text-sm font-black text-indigo-600 mt-1">
                        ${subscriptionInfo.planes.mensual.precio.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-400">+30 días</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPlanSeleccionado("anual")}
                      className={`p-3 rounded-xl border font-bold text-left transition ${
                        planSeleccionado === "anual"
                          ? "border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 ring-1 ring-purple-600"
                          : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      <div className="text-xs font-black">Paquete Anual (1 Año)</div>
                      <div className="text-sm font-black text-purple-600 mt-1">
                        ${subscriptionInfo.planes.anual.precio.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-400">+365 días</div>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold mb-1">Banco de Origen *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Banco Pichincha, Guayaquil, Produbanco..."
                      value={bancoOrigen}
                      onChange={(e) => setBancoOrigen(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">N° Comprobante / Depósito *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: 14892100"
                      value={numeroComprobante}
                      onChange={(e) => setNumeroComprobante(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold mb-1">Fecha de la Transferencia *</label>
                  <input
                    type="date"
                    required
                    value={fechaTransferencia}
                    onChange={(e) => setFechaTransferencia(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">
                    Adjuntar Foto o Captura de Pantalla del Comprobante (Opcional)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => setComprobanteFile(e.target.files?.[0] || null)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Formatos permitidos: JPG, PNG, WebP (Máx. 5 MB).
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Registrar Pago</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
