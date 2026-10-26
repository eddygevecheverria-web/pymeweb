"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  Upload,
  Save,
  CheckCircle2,
  CreditCard,
  Building2,
  Copy,
  Check,
  Sparkles,
  MessageCircle,
  FileText,
  Loader2,
  Calendar,
} from "lucide-react";

export default function MiNegocioPage() {
  const [form, setForm] = useState({
    nombre: "",
    slug: "",
    ruc_nit: "",
    telefono: "",
    whatsapp_contacto: "",
    direccion: "",
    logo_url: "",
    fecha_expiracion: "",
    estado: "activo",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Modal y datos de suscripción
  const [showSubModal, setShowSubModal] = useState(false);
  const [subData, setSubData] = useState<any>(null);
  const [copiedBank, setCopiedBank] = useState(false);
  const [planSeleccionado, setPlanSeleccionado] = useState<"mensual" | "anual">("mensual");
  const [bancoOrigen, setBancoOrigen] = useState("Banco Pichincha");
  const [numeroComprobante, setNumeroComprobante] = useState("");
  const [fechaTransferencia, setFechaTransferencia] = useState(new Date().toISOString().slice(0, 10));
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [submittingSub, setSubmittingSub] = useState(false);
  const [subSuccessMsg, setSubSuccessMsg] = useState("");
  const [whatsappNotifyUrl, setWhatsappNotifyUrl] = useState<string | null>(null);
  const [subErrorMsg, setSubErrorMsg] = useState("");

  const loadSubscriptionInfo = () => {
    apiFetch("/tenant/subscription.php")
      .then((res) => {
        if (res.success) {
          setSubData(res);
        }
      })
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    apiFetch("/tenant/business.php").then((res) => {
      if (res.business) {
        setForm({
          nombre: res.business.nombre || "",
          slug: res.business.slug || "",
          ruc_nit: res.business.ruc_nit || "",
          telefono: res.business.telefono || "",
          whatsapp_contacto: res.business.whatsapp_contacto || res.business.telefono || "",
          direccion: res.business.direccion || "",
          logo_url: res.business.logo_url || "",
          fecha_expiracion: res.business.fecha_expiracion || "",
          estado: res.business.estado || "activo",
        });
        setPreview(res.business.logo_url || "");
      }
    });

    loadSubscriptionInfo();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");

    const fd = new FormData();
    fd.append("nombre", form.nombre);
    fd.append("ruc_nit", form.ruc_nit);
    fd.append("telefono", form.telefono);
    fd.append("whatsapp_contacto", form.whatsapp_contacto);
    fd.append("direccion", form.direccion);
    if (logoFile) {
      fd.append("logo", logoFile);
    }

    try {
      const res = await apiFetch("/tenant/business.php", {
        method: "POST",
        body: fd,
      });
      setMsg(res.message);
      if (res.business?.logo_url) {
        setPreview(res.business.logo_url);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyBank = () => {
    if (!subData?.datos_bancarios) return;
    navigator.clipboard.writeText(subData.datos_bancarios);
    setCopiedBank(true);
    setTimeout(() => setCopiedBank(false), 2000);
  };

  const handleReportSubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingSub(true);
    setSubErrorMsg("");
    setSubSuccessMsg("");

    try {
      const fd = new FormData();
      fd.append("plan_tipo", planSeleccionado);
      fd.append("banco_origen", bancoOrigen);
      fd.append("numero_comprobante", numeroComprobante.trim());
      fd.append("fecha_transferencia", fechaTransferencia);
      if (comprobanteFile) {
        fd.append("comprobante", comprobanteFile);
      }

      const res = await apiFetch<any>("/tenant/subscription.php", {
        method: "POST",
        body: fd,
      });

      if (res.success) {
        setSubSuccessMsg(res.message);
        setWhatsappNotifyUrl(res.whatsapp_url || null);
        setNumeroComprobante("");
        setComprobanteFile(null);
        loadSubscriptionInfo();
      }
    } catch (err: any) {
      setSubErrorMsg(err.message || "Error al registrar comprobante.");
    } finally {
      setSubmittingSub(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuración de Mi Negocio</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Este logotipo y datos fiscales aparecerán en tus facturas electrónicas y en tu tienda pública{" "}
          <strong>/{form.slug}</strong>.
        </p>
      </div>

      {msg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 flex items-center gap-2 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {/* BANNER DE SUSCRIPCIÓN SAAS Y TRANSFERENCIA */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-50/80 via-purple-50/80 to-indigo-50/80 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-600/30">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase">Suscripción PymeWeb ERP</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                  form.estado === "activo"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                }`}
              >
                {form.estado === "prueba" ? "Periodo de Prueba" : "Cuenta Activa"}
              </span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-0.5">
              Vigencia hasta: <strong>{form.fecha_expiracion || "Consultando..."}</strong>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowSubModal(true);
            setSubSuccessMsg("");
            setSubErrorMsg("");
          }}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition whitespace-nowrap"
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Renovar con Transferencia</span>
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5"
      >
        <div className="flex items-center gap-5">
          <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-800">
            {preview ? (
              <img src={preview} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-slate-400 text-center px-2">Sin logo</span>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Logotipo del Negocio</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setLogoFile(file);
                  setPreview(URL.createObjectURL(file));
                }
              }}
              className="text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 dark:file:bg-indigo-950 dark:file:text-indigo-300 hover:file:bg-indigo-100"
            />
            <p className="text-[11px] text-slate-400 mt-1">PNG, JPG o WebP hasta 5MB. Se optimizará a 400px.</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Nombre Comercial *</label>
          <input
            type="text"
            required
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">RUC o Cédula Fiscal</label>
            <input
              type="text"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
              value={form.ruc_nit}
              onChange={(e) => setForm({ ...form, ruc_nit: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Teléfono Principal</label>
            <input
              type="text"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">WhatsApp de Contacto Oficial</label>
          <input
            type="text"
            placeholder="Ej: 0991234567"
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
            value={form.whatsapp_contacto}
            onChange={(e) => setForm({ ...form, whatsapp_contacto: e.target.value })}
          />
          <span className="text-xs text-slate-400 mt-0.5 block">
            Número donde tus clientes enviarán consultas desde la tienda online.
          </span>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Dirección del Local / Matriz</label>
          <input
            type="text"
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
            value={form.direccion}
            onChange={(e) => setForm({ ...form, direccion: e.target.value })}
          />
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500">
            Suscripción válida hasta: <strong>{form.fecha_expiracion}</strong>
          </span>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition"
          >
            <Save className="w-4 h-4" />
            {saving ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      </form>

      {/* MODAL DE RENOVACIÓN DE SUSCRIPCIÓN POR TRANSFERENCIA */}
      {showSubModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    Renovación de Suscripción PymeWeb
                  </h3>
                  <span className="text-[11px] text-slate-500">Pago por Transferencia Bancaria</span>
                </div>
              </div>
              <button
                onClick={() => setShowSubModal(false)}
                className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 font-bold"
              >
                ✕
              </button>
            </div>

            {subSuccessMsg ? (
              <div className="space-y-4 py-4 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-base font-black text-slate-900 dark:text-white">
                  ¡Comprobante Registrado con Éxito!
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {subSuccessMsg}
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
                  onClick={() => setShowSubModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <form onSubmit={handleReportSubSubmit} className="space-y-3.5 text-xs text-left">
                {subErrorMsg && (
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 text-red-600 text-xs font-bold">
                    {subErrorMsg}
                  </div>
                )}

                {/* Selección de Plan */}
                <div>
                  <label className="block font-bold mb-1">Selecciona tu Plan *</label>
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
                        ${Number(subData?.planes?.mensual?.precio || 15).toFixed(2)}
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
                        ${Number(subData?.planes?.anual?.precio || 130).toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-400">+365 días</div>
                    </button>
                  </div>
                </div>

                {/* Cuentas Bancarias */}
                <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] text-indigo-900 dark:text-indigo-300 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Cuentas para Transferencia:</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyBank}
                      className="text-[10px] text-indigo-600 font-bold hover:underline flex items-center gap-0.5"
                    >
                      {copiedBank ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedBank ? "Copiado" : "Copiar"}</span>
                    </button>
                  </div>
                  <p className="font-mono text-[11px] whitespace-pre-line text-slate-700 dark:text-slate-300">
                    {subData?.datos_bancarios || "Banco Pichincha - Cta Corriente # 2100458921"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold mb-1">Banco de Origen *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Banco Pichincha, Guayaquil..."
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
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setComprobanteFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Formatos: JPG, PNG, WebP (Máx. 5 MB).
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowSubModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submittingSub}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
                  >
                    {submittingSub && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
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
