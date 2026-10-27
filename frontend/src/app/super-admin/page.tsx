"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  ShieldCheck,
  Users,
  Clock,
  AlertTriangle,
  Ban,
  Plus,
  Search,
  CalendarPlus,
  Edit3,
  Power,
  LogOut,
  DollarSign,
  CreditCard,
  Settings,
  CheckCircle2,
  XCircle,
  Eye,
  FileText,
  Save,
  Building2,
  ExternalLink,
  MessageCircle,
  Loader2,
  Copy,
  Check,
  Sparkles,
  Key,
  Send,
  Mail,
  Lock,
  RefreshCw,
  Phone,
  Menu,
  Store,
  ChevronRight,
} from "lucide-react";

interface Metrics {
  total_negocios: number;
  negocios_activos: number;
  negocios_prueba: number;
  negocios_inactivos: number;
  proximos_expirar: number;
  ingresos_mes: number;
}

interface Tenant {
  id: number;
  nombre: string;
  slug: string;
  ruc_nit: string | null;
  telefono: string | null;
  estado: "activo" | "prueba" | "inactivo";
  fecha_registro: string;
  fecha_expiracion: string;
  dias_restantes: number;
  dueno_nombre: string;
  dueno_email: string;
}

interface SaasConfig {
  id: number;
  precio_mensual: number;
  precio_anual: number;
  dias_prueba: number;
  datos_bancarios: string;
  whatsapp_soporte: string;
  email_soporte: string;
}

interface SolicitudSuscripcion {
  id: number;
  negocio_id: number;
  plan_tipo: "mensual" | "anual";
  dias: number;
  monto: number | string;
  banco_origen: string | null;
  numero_comprobante: string;
  fecha_transferencia: string | null;
  comprobante_url: string | null;
  estado: "pendiente" | "aprobado" | "rechazado";
  motivo_rechazo: string | null;
  revisado_por: number | null;
  revisado_en: string | null;
  created_at: string;
  negocio_nombre: string;
  negocio_slug: string;
  negocio_ruc: string | null;
  negocio_telefono: string | null;
  negocio_estado: string;
  negocio_expiracion: string;
  negocio_dias_restantes: number;
  dueno_nombre: string;
  dueno_email: string;
}

interface PagoSaas {
  id: number;
  negocio_id: number;
  negocio_nombre: string;
  negocio_slug: string;
  dias_agregados: number;
  monto: string | number;
  metodo_pago: string;
  notas: string | null;
  fecha_expiracion_previa: string;
  fecha_expiracion_nueva: string;
  created_at: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost/pymeweb/backend-api/api";

function getAssetUrl(url?: string | null) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = API_BASE.replace(/\/api\/?$/, "");
  return `${base}/${url.replace(/^\//, "")}`;
}

export default function SuperAdminDashboard() {
  const router = useRouter();

  // Navegación principal de pestañas
  const [tabActiva, setTabActiva] = useState<"inquilinos" | "suscripciones" | "configuracion">("inquilinos");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Estados Tab Inquilinos
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState("");
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");

  // Modal Cliente
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [formData, setFormData] = useState({
    nombre_negocio: "",
    ruc_nit: "",
    telefono: "",
    dueno_nombre: "",
    dueno_email: "",
    password: "",
    dias_iniciales: 7,
    estado: "prueba",
  });

  // Estados Tab Suscripciones & Transferencias
  const [solicitudes, setSolicitudes] = useState<SolicitudSuscripcion[]>([]);
  const [pagosHistorico, setPagosHistorico] = useState<PagoSaas[]>([]);
  const [metricasSuscripcion, setMetricasSuscripcion] = useState<any>(null);
  const [filtroSolEstado, setFiltroSolEstado] = useState<string>("pendiente");
  const [loadingSol, setLoadingSol] = useState(false);
  const [previewImgUrl, setPreviewImgUrl] = useState<string | null>(null);

  // Modal Rechazo Solicitud
  const [rechazandoSol, setRechazandoSol] = useState<SolicitudSuscripcion | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");

  // Modal Renovación Manual por Transferencia
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    negocio_id: "",
    plan_tipo: "mensual" as "mensual" | "anual",
    monto: "15.00",
    banco_origen: "Banco Pichincha",
    numero_comprobante: "",
    notas: "",
  });
  const [processingManual, setProcessingManual] = useState(false);

  // Estados Tab Configuración SaaS
  const [saasConfig, setSaasConfig] = useState<SaasConfig>({
    id: 1,
    precio_mensual: 15.0,
    precio_anual: 130.0,
    dias_prueba: 7,
    datos_bancarios: "",
    whatsapp_soporte: "",
    email_soporte: "",
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [copiedBank, setCopiedBank] = useState(false);

  // Estados Modal Enviar Credenciales
  const [credModalOpen, setCredModalOpen] = useState(false);
  const [credModalData, setCredModalData] = useState<{
    negocio_id: number;
    negocio_nombre: string;
    slug: string;
    dueno_nombre: string;
    dueno_email: string;
    telefono: string;
    password: string;
    dias_restantes: number;
    fecha_expiracion?: string;
    login_url: string;
    store_url: string;
    whatsapp_text: string;
    whatsapp_url: string;
  } | null>(null);
  const [copiedCred, setCopiedCred] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const [customPassword, setCustomPassword] = useState("");
  const [updatingPass, setUpdatingPass] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  // 1. Cargar Clientes e Inquilinos
  const loadData = async () => {
    setLoading(true);
    try {
      const [m, t] = await Promise.all([
        apiFetch<Metrics>("/super-admin/metrics.php"),
        apiFetch<{ tenants: Tenant[] }>(
          `/super-admin/tenants.php?q=${encodeURIComponent(search)}&filtro=${encodeURIComponent(filtro)}`
        ),
      ]);
      setMetrics(m);
      setTenants(t.tenants);
    } catch (err: any) {
      if (err.message?.includes("No autenticado") || err.message?.includes("Acceso exclusivo")) {
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  };

  // 2. Cargar Solicitudes de Suscripción & Transferencias
  const loadSolicitudes = async () => {
    setLoadingSol(true);
    try {
      const res = await apiFetch<any>(
        `/super-admin/subscription-requests.php?estado=${encodeURIComponent(filtroSolEstado)}`
      );
      if (res.success) {
        setSolicitudes(res.solicitudes || []);
        setPagosHistorico(res.pagos || []);
        setMetricasSuscripcion(res.metricas || null);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingSol(false);
    }
  };

  // 3. Cargar Configuración SaaS
  const loadSaasConfig = async () => {
    try {
      const res = await apiFetch<any>("/super-admin/saas-config.php");
      if (res.success && res.config) {
        setSaasConfig(res.config);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
    loadSaasConfig();
  }, [filtro]);

  useEffect(() => {
    if (tabActiva === "suscripciones") {
      loadSolicitudes();
    }
  }, [tabActiva, filtroSolEstado]);

  // Guardar Configuración SaaS
  const handleSaveSaasConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await apiFetch<any>("/super-admin/saas-config.php", {
        method: "POST",
        body: JSON.stringify(saasConfig),
      });
      if (res.success) {
        setFeedback("Configuración de tarifas y cuentas bancarias guardada con éxito.");
      }
    } catch (err: any) {
      alert(err.message || "Error al guardar configuración");
    } finally {
      setSavingConfig(false);
    }
  };

  // Aprobar Solicitud de Transferencia
  const handleAprobarSolicitud = async (sol: SolicitudSuscripcion) => {
    const nombrePlan = sol.plan_tipo === "anual" ? "Paquete Anual (1 Año / +365 días)" : "Plan Mensual (+30 días)";
    if (
      !window.confirm(
        `¿Deseas APROBAR la transferencia de $${Number(sol.monto).toFixed(2)} para "${sol.negocio_nombre}"?\n\nSe activará su cuenta con el ${nombrePlan}.`
      )
    ) {
      return;
    }

    try {
      const res = await apiFetch<any>("/super-admin/subscription-requests.php", {
        method: "POST",
        body: JSON.stringify({ action: "aprobar", id: sol.id }),
      });
      if (res.success) {
        setFeedback(res.message);
        loadSolicitudes();
        loadData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Rechazar Solicitud de Transferencia
  const handleRechazarSolicitud = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rechazandoSol) return;

    try {
      const res = await apiFetch<any>("/super-admin/subscription-requests.php", {
        method: "POST",
        body: JSON.stringify({
          action: "rechazar",
          id: rechazandoSol.id,
          motivo: motivoRechazo.trim() || "Comprobante bancario no válido o monto no acreditado.",
        }),
      });
      if (res.success) {
        setFeedback(res.message);
        setRechazandoSol(null);
        setMotivoRechazo("");
        loadSolicitudes();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Registrar Transferencia / Renovación Manual
  const handleManualRenewalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingManual(true);
    try {
      const res = await apiFetch<any>("/super-admin/subscription-requests.php", {
        method: "POST",
        body: JSON.stringify({
          action: "manual",
          negocio_id: Number(manualForm.negocio_id),
          plan_tipo: manualForm.plan_tipo,
          monto: parseFloat(manualForm.monto) || 0,
          banco_origen: manualForm.banco_origen,
          numero_comprobante: manualForm.numero_comprobante,
          notas: manualForm.notas,
        }),
      });
      if (res.success) {
        setFeedback(res.message);
        setManualModalOpen(false);
        setManualForm({
          negocio_id: "",
          plan_tipo: "mensual",
          monto: String(saasConfig.precio_mensual || "15.00"),
          banco_origen: "Banco Pichincha",
          numero_comprobante: "",
          notas: "",
        });
        loadSolicitudes();
        loadData();
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessingManual(false);
    }
  };

  // Renovación directa en tabla clientes
  const handleRenew = async (tenant: Tenant, dias: 30 | 180 | 365) => {
    const sugerido = dias === 365 ? saasConfig.precio_anual : saasConfig.precio_mensual;
    const montoStr = window.prompt(
      `Aprobar +${dias} días para "${tenant.nombre}".\nIngresa el monto cobrado por transferencia (USD):`,
      String(sugerido)
    );
    if (montoStr === null) return;

    try {
      const res = await apiFetch("/super-admin/renew.php", {
        method: "POST",
        body: JSON.stringify({
          negocio_id: tenant.id,
          dias,
          monto: parseFloat(montoStr) || 0,
          metodo_pago: "transferencia",
        }),
      });
      setFeedback(res.message);
      loadData();
      if (tabActiva === "suscripciones") loadSolicitudes();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleSuspend = async (tenant: Tenant) => {
    const nuevoEstado = tenant.estado === "inactivo" ? "activo" : "inactivo";
    const accion = nuevoEstado === "inactivo" ? "SUSPENDER" : "REACTIVAR";
    if (!window.confirm(`¿Confirmas que deseas ${accion} el negocio "${tenant.nombre}"?`)) return;

    try {
      const res = await apiFetch("/super-admin/status.php", {
        method: "PATCH",
        body: JSON.stringify({ negocio_id: tenant.id, estado: nuevoEstado }),
      });
      setFeedback(res.message);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openCreateModal = () => {
    setEditingTenant(null);
    setFormData({
      nombre_negocio: "",
      ruc_nit: "",
      telefono: "",
      dueno_nombre: "",
      dueno_email: "",
      password: "",
      dias_iniciales: saasConfig.dias_prueba || 7,
      estado: "prueba",
    });
    setModalOpen(true);
  };

  const openEditModal = (t: Tenant) => {
    setEditingTenant(t);
    setFormData({
      nombre_negocio: t.nombre,
      ruc_nit: t.ruc_nit || "",
      telefono: t.telefono || "",
      dueno_nombre: t.dueno_nombre || "",
      dueno_email: t.dueno_email || "",
      password: "",
      dias_iniciales: 7,
      estado: t.estado,
    });
    setModalOpen(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTenant) {
        await apiFetch("/super-admin/tenants.php", {
          method: "PUT",
          body: JSON.stringify({
            id: editingTenant.id,
            nombre: formData.nombre_negocio,
            ruc_nit: formData.ruc_nit,
            telefono: formData.telefono,
            dueno_nombre: formData.dueno_nombre,
            dueno_email: formData.dueno_email,
          }),
        });
        setFeedback("Cliente actualizado correctamente.");
        setModalOpen(false);
        loadData();
      } else {
        const res = await apiFetch<any>("/super-admin/tenants.php", {
          method: "POST",
          body: JSON.stringify(formData),
        });
        setFeedback(`Cliente creado exitosamente con ${formData.dias_iniciales} días de prueba.`);
        setModalOpen(false);
        loadData();

        // Abrir inmediatamente modal de envío de credenciales
        prepareCredentialsModal({
          negocio_id: res.negocio_id,
          negocio_nombre: res.nombre_negocio || formData.nombre_negocio,
          slug: res.slug || "mi-tienda",
          dueno_nombre: res.dueno_nombre || formData.dueno_nombre,
          dueno_email: res.dueno_email || formData.dueno_email,
          telefono: res.telefono || formData.telefono,
          password: res.password || formData.password,
          dias_restantes: res.dias_iniciales || formData.dias_iniciales,
          fecha_expiracion: res.fecha_expiracion,
        });
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const generateRandomPassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$";
    let pass = "";
    for (let i = 0; i < 9; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  const prepareCredentialsModal = (data: {
    negocio_id: number;
    negocio_nombre: string;
    slug: string;
    dueno_nombre: string;
    dueno_email: string;
    telefono: string;
    password?: string;
    dias_restantes?: number;
    fecha_expiracion?: string;
  }) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3005";
    const loginUrl = `${origin}/login`;
    const storeUrl = `${origin}/${data.slug}`;
    const cleanPhone = (data.telefono || "").replace(/\D/g, "");
    const formattedPhone = cleanPhone.startsWith("593")
      ? cleanPhone
      : cleanPhone.startsWith("0")
      ? `593${cleanPhone.substring(1)}`
      : cleanPhone;

    const pass = data.password || "";
    const passSection = pass
      ? `🔑 *Contraseña:* ${pass}\n`
      : `🔑 *Contraseña:* (Tu contraseña actual de acceso)\n`;

    const dias = data.dias_restantes ?? 7;
    const expText = data.fecha_expiracion ? ` (válido hasta ${data.fecha_expiracion})` : "";

    const whatsappText =
      `¡Hola *${data.dueno_nombre}*! 👋\n\n` +
      `Te damos la bienvenida a *PymeWeb ERP* para tu negocio *${data.negocio_nombre}*.\n\n` +
      `Aquí tienes tus credenciales y accesos oficiales a la plataforma:\n\n` +
      `🌐 *Plataforma de Acceso:* ${loginUrl}\n` +
      `👤 *Usuario / Email:* ${data.dueno_email}\n` +
      passSection +
      `🏪 *Tu Tienda Virtual:* ${storeUrl}\n` +
      `⏳ *Período de Acceso:* ${dias} días${expText}\n\n` +
      `✨ Podrás emitir Facturas Electrónicas SRI, usar el Punto de Venta POS y gestionar pedidos de tu tienda online.\n\n` +
      `¡Muchos éxitos con tu negocio! Si necesitas soporte estamos a tu disposición.`;

    const whatsappUrl = formattedPhone
      ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(whatsappText)}`
      : `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;

    setCredModalData({
      negocio_id: data.negocio_id,
      negocio_nombre: data.negocio_nombre,
      slug: data.slug,
      dueno_nombre: data.dueno_nombre,
      dueno_email: data.dueno_email,
      telefono: data.telefono,
      password: pass,
      dias_restantes: dias,
      fecha_expiracion: data.fecha_expiracion,
      login_url: loginUrl,
      store_url: storeUrl,
      whatsapp_text: whatsappText,
      whatsapp_url: whatsappUrl,
    });
    setCustomPassword(pass);
    setCopiedCred(false);
    setCopiedPass(false);
    setEmailStatus(null);
    setCredModalOpen(true);
  };

  const handleUpdatePasswordAndRegenerate = async (newPass: string) => {
    if (!credModalData) return;
    if (newPass.length < 6) {
      alert("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setUpdatingPass(true);
    try {
      const res = await apiFetch<any>("/super-admin/send-credentials.php", {
        method: "POST",
        body: JSON.stringify({
          negocio_id: credModalData.negocio_id,
          new_password: newPass,
          origin: typeof window !== "undefined" ? window.location.origin : "http://localhost:3005",
        }),
      });
      if (res.success && res.credentials) {
        setCredModalData({
          ...credModalData,
          password: res.credentials.password,
          whatsapp_text: res.credentials.whatsapp_text,
          whatsapp_url: res.credentials.whatsapp_url,
        });
        setCustomPassword(res.credentials.password);
        setFeedback("Contraseña actualizada y credenciales regeneradas con éxito.");
      }
    } catch (err: any) {
      alert(err.message || "Error al actualizar contraseña");
    } finally {
      setUpdatingPass(false);
    }
  };

  const handleSendCredentialsEmail = async () => {
    if (!credModalData) return;
    setSendingEmail(true);
    setEmailStatus(null);
    try {
      const res = await apiFetch<any>("/super-admin/send-credentials.php", {
        method: "POST",
        body: JSON.stringify({
          negocio_id: credModalData.negocio_id,
          new_password: customPassword || credModalData.password,
          send_email: true,
          origin: typeof window !== "undefined" ? window.location.origin : "http://localhost:3005",
        }),
      });
      if (res.success) {
        setEmailStatus("¡Correo enviado exitosamente al cliente!");
      } else {
        setEmailStatus("No se pudo enviar el correo automáticamente. Puedes usar el botón de WhatsApp o Copiar.");
      }
    } catch (err: any) {
      setEmailStatus(`Error al enviar correo: ${err.message}`);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("pymeweb_token");
    localStorage.removeItem("pymeweb_user");
    router.push("/login");
  };

  const pendientesCount = metricasSuscripcion?.pendientes_count
    ? Number(metricasSuscripcion.pendientes_count)
    : solicitudes.filter((s) => s.estado === "pendiente").length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row">
      {/* ========================================================================= */}
      {/* MENÚ LATERAL IZQUIERDO (SIDEBAR PERMANENTE)                               */}
      {/* ========================================================================= */}
      <aside
        className={`fixed md:sticky top-0 z-40 h-screen w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between transition-transform duration-200 ease-in-out shrink-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Parte Superior del Sidebar */}
        <div className="p-5 flex flex-col gap-6 overflow-y-auto">
          {/* Logo & Marca Super Admin */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="font-extrabold text-base leading-tight tracking-tight text-slate-900 dark:text-white">
                    PymeWeb
                  </h1>
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    Admin
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Control Central SaaS
                </p>
              </div>
            </div>

            {/* Botón cerrar en móvil */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Cerrar menú"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          {/* Menú de Navegación Izquierdo */}
          <nav className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 pb-1 block">
              Módulos de Gestión
            </span>

            {/* 1. Inquilinos / Negocios */}
            <button
              type="button"
              onClick={() => {
                setTabActiva("inquilinos");
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3.5 py-3 rounded-2xl font-bold text-xs flex items-center justify-between transition group ${
                tabActiva === "inquilinos"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <Users
                  className={`w-4 h-4 ${
                    tabActiva === "inquilinos"
                      ? "text-white"
                      : "text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                  }`}
                />
                <span>Inquilinos / Negocios</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  tabActiva === "inquilinos"
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                {tenants.length}
              </span>
            </button>

            {/* 2. Suscripciones & Transferencias */}
            <button
              type="button"
              onClick={() => {
                setTabActiva("suscripciones");
                loadSolicitudes();
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3.5 py-3 rounded-2xl font-bold text-xs flex items-center justify-between transition group ${
                tabActiva === "suscripciones"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <CreditCard
                  className={`w-4 h-4 ${
                    tabActiva === "suscripciones"
                      ? "text-white"
                      : "text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                  }`}
                />
                <span>Suscripciones & Pagos</span>
              </div>
              {pendientesCount > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse">
                  {pendientesCount}
                </span>
              ) : (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    tabActiva === "suscripciones"
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {solicitudes.length}
                </span>
              )}
            </button>

            {/* 3. Configuración SaaS */}
            <button
              type="button"
              onClick={() => {
                setTabActiva("configuracion");
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3.5 py-3 rounded-2xl font-bold text-xs flex items-center justify-between transition group ${
                tabActiva === "configuracion"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <Settings
                  className={`w-4 h-4 ${
                    tabActiva === "configuracion"
                      ? "text-white"
                      : "text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                  }`}
                />
                <span>Tarifas & Bancos SaaS</span>
              </div>
            </button>
          </nav>

          {/* Acciones Rápidas en el menú */}
          <div className="pt-2 space-y-2 border-t border-slate-200/80 dark:border-slate-800">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 pb-1 block">
              Acciones Rápidas
            </span>

            <button
              type="button"
              onClick={() => {
                openCreateModal();
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-3.5 py-2.5 rounded-xl font-bold text-xs bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 flex items-center gap-2 transition"
            >
              <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>+ Nuevo Inquilino ({saasConfig.dias_prueba || 7}d)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setManualModalOpen(true);
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-3.5 py-2.5 rounded-xl font-bold text-xs bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 flex items-center gap-2 transition"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Registrar Transferencia</span>
            </button>

            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="w-full text-left px-3.5 py-2.5 rounded-xl font-medium text-xs text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center justify-between transition"
            >
              <span className="flex items-center gap-2">
                <Store className="w-4 h-4" />
                <span>Página Publicitaria</span>
              </span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Parte Inferior del Sidebar (Usuario & Salir) */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                A
              </div>
              <div className="min-w-0">
                <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                  Super Admin
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  admin@pymeweb.com
                </p>
              </div>
            </div>

            <ThemeToggle />
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 border border-transparent hover:border-red-200 dark:hover:border-red-900 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Backdrop para móvil cuando el menú está abierto */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 md:hidden backdrop-blur-xs"
        />
      )}

      {/* ========================================================================= */}
      {/* ÁREA DE CONTENIDO PRINCIPAL (DERECHA)                                     */}
      {/* ========================================================================= */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* TOPBAR SUPERIOR (Móvil & Encabezado de Sección) */}
        <header className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            {/* Botón abrir menú en móvil */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Abrir menú lateral"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <h2 className="font-black text-base sm:text-lg text-slate-900 dark:text-white leading-tight">
                {tabActiva === "inquilinos" && "Inquilinos & Negocios Registrados"}
                {tabActiva === "suscripciones" && "Suscripciones & Transferencias Bancarias"}
                {tabActiva === "configuracion" && "Configuración SaaS & Tarifas"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                {tabActiva === "inquilinos" && "Supervisión de cuentas, días restantes y credenciales de acceso."}
                {tabActiva === "suscripciones" && "Aprobación de comprobantes de pago por transferencia y renovaciones."}
                {tabActiva === "configuracion" && "Definición de precios de planes mensual/anual y cuentas bancarias oficiales."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nuevo Inquilino</span>
            </button>
          </div>
        </header>

        {/* CONTENIDO PRINCIPAL */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6">
        {feedback && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex justify-between items-center text-xs font-semibold shadow-xs">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              {feedback}
            </span>
            <button onClick={() => setFeedback("")} className="font-bold text-sm px-2">
              ✕
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 1: INQUILINOS Y NEGOCIOS                                         */}
        {/* ========================================================================= */}
        {tabActiva === "inquilinos" && (
          <div className="space-y-6">
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div
                onClick={() => setFiltro("activo")}
                className="cursor-pointer bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition shadow-xs"
              >
                <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
                  <span>Negocios Activos</span>
                  <Users className="w-5 h-5 text-emerald-500" />
                </div>
                <p className="text-3xl font-black mt-2 text-emerald-600 dark:text-emerald-400">
                  {metrics?.negocios_activos ?? 0}
                </p>
              </div>

              <div
                onClick={() => setFiltro("prueba")}
                className="cursor-pointer bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 transition shadow-xs"
              >
                <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
                  <span>En Prueba ({saasConfig.dias_prueba || 7}d)</span>
                  <Clock className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-3xl font-black mt-2 text-blue-600 dark:text-blue-400">
                  {metrics?.negocios_prueba ?? 0}
                </p>
              </div>

              <div
                onClick={() => setFiltro("por_expirar")}
                className="cursor-pointer bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-amber-500 transition shadow-xs"
              >
                <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
                  <span>Por Expirar (≤3d)</span>
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
                <p className="text-3xl font-black mt-2 text-amber-600 dark:text-amber-400">
                  {metrics?.proximos_expirar ?? 0}
                </p>
              </div>

              <div
                onClick={() => setFiltro("inactivo")}
                className="cursor-pointer bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-red-500 transition shadow-xs"
              >
                <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
                  <span>Inactivos / Vencidos</span>
                  <Ban className="w-5 h-5 text-red-500" />
                </div>
                <p className="text-3xl font-black mt-2 text-red-600 dark:text-red-400">
                  {metrics?.negocios_inactivos ?? 0}
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
                  <span>Ingresos del Mes</span>
                  <DollarSign className="w-5 h-5 text-indigo-500" />
                </div>
                <p className="text-3xl font-black mt-2 text-indigo-600 dark:text-indigo-400">
                  ${metrics?.ingresos_mes?.toFixed(2) ?? "0.00"}
                </p>
              </div>
            </section>

            <section className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                <Search className="w-5 h-5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar por negocio, correo, slug o RUC/NIT..."
                  className="w-full bg-transparent outline-none text-xs"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadData()}
                />
                <button
                  onClick={loadData}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold"
                >
                  Buscar
                </button>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-bold flex-wrap">
                {[
                  { id: "", label: "Todos" },
                  { id: "activo", label: "Activos" },
                  { id: "prueba", label: "En Prueba" },
                  { id: "por_expirar", label: "Por Expirar" },
                  { id: "inactivo", label: "Inactivos" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFiltro(tab.id)}
                    className={`px-3 py-1.5 rounded-xl transition ${
                      filtro === tab.id
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 text-[11px] font-black uppercase">
                    <th className="py-3.5 px-4">Negocio / Tienda</th>
                    <th className="py-3.5 px-4">Propietario</th>
                    <th className="py-3.5 px-4">Estado</th>
                    <th className="py-3.5 px-4">Vencimiento</th>
                    <th className="py-3.5 px-4">Renovación Rápida</th>
                    <th className="py-3.5 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Cargando negocios...
                      </td>
                    </tr>
                  ) : tenants.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No se encontraron negocios con este criterio.
                      </td>
                    </tr>
                  ) : (
                    tenants.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-sm text-slate-900 dark:text-white">{t.nombre}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            /{t.slug} {t.ruc_nit ? `• RUC: ${t.ruc_nit}` : ""}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold">{t.dueno_nombre}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{t.dueno_email}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              t.estado === "activo"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : t.estado === "prueba"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                                : "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                            }`}
                          >
                            {t.estado}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold">{t.fecha_expiracion}</div>
                          <div
                            className={`text-[11px] font-semibold ${
                              t.dias_restantes < 0
                                ? "text-red-500"
                                : t.dias_restantes <= 3
                                ? "text-amber-500"
                                : "text-slate-500"
                            }`}
                          >
                            {t.dias_restantes < 0
                              ? `Venció hace ${Math.abs(t.dias_restantes)} días`
                              : `${t.dias_restantes} días restantes`}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleRenew(t, 30)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-600 hover:text-white text-indigo-700 dark:text-indigo-300 text-xs font-bold transition border border-indigo-200 dark:border-indigo-800"
                              title={`Mes ($${saasConfig.precio_mensual || 15})`}
                            >
                              <CalendarPlus className="w-3 h-3" />
                              <span>+1 Mes (${saasConfig.precio_mensual || 15})</span>
                            </button>
                            <button
                              onClick={() => handleRenew(t, 365)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-600 hover:text-white text-purple-700 dark:text-purple-300 text-xs font-bold transition border border-purple-200 dark:border-purple-800"
                              title={`Año ($${saasConfig.precio_anual || 130})`}
                            >
                              <Sparkles className="w-3 h-3 text-amber-500" />
                              <span>+1 Año (${saasConfig.precio_anual || 130})</span>
                            </button>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() =>
                                prepareCredentialsModal({
                                  negocio_id: t.id,
                                  negocio_nombre: t.nombre,
                                  slug: t.slug,
                                  dueno_nombre: t.dueno_nombre,
                                  dueno_email: t.dueno_email,
                                  telefono: t.telefono || "",
                                  dias_restantes: t.dias_restantes,
                                  fecha_expiracion: t.fecha_expiracion,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-600 hover:text-white transition text-xs font-bold"
                              title="Enviar o ver credenciales del cliente"
                            >
                              <Key className="w-3.5 h-3.5" />
                              <span className="hidden xl:inline">Credenciales</span>
                            </button>
                            <button
                              onClick={() => openEditModal(t)}
                              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Editar cliente"
                            >
                              <Edit3 className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                            </button>
                            <button
                              onClick={() => handleToggleSuspend(t)}
                              className={`p-1.5 rounded-xl border transition ${
                                t.estado === "inactivo"
                                  ? "border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                                  : "border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                              }`}
                              title={t.estado === "inactivo" ? "Reactivar cuenta" : "Suspender cuenta"}
                            >
                              <Power className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 2: SUSCRIPCIONES Y TRANSFERENCIAS BANCARIAS                      */}
        {/* ========================================================================= */}
        {tabActiva === "suscripciones" && (
          <div className="space-y-6">
            {/* Métricas de Recaudación */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-amber-200 dark:border-amber-800/60 shadow-xs">
                <div className="flex items-center justify-between text-xs font-bold text-amber-600 uppercase">
                  <span>Transferencias Pendientes</span>
                  <Clock className="w-5 h-5 text-amber-500" />
                </div>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl font-black text-amber-600">{pendientesCount}</span>
                  <span className="text-xs text-slate-500 font-semibold">por verificar y aprobar</span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex items-center justify-between text-xs font-bold text-indigo-600 uppercase">
                  <span>Recaudado este Mes</span>
                  <DollarSign className="w-5 h-5 text-indigo-500" />
                </div>
                <p className="text-3xl font-black mt-2 text-indigo-600 dark:text-indigo-400">
                  ${Number(metricasSuscripcion?.recaudado_mes_actual || 0).toFixed(2)}
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-600 uppercase">
                  <span>Total Histórico Recaudado</span>
                  <Building2 className="w-5 h-5 text-emerald-500" />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                    ${Number(metricasSuscripcion?.total_recaudado || 0).toFixed(2)}
                  </span>
                  <button
                    onClick={() => {
                      setManualForm({
                        negocio_id: tenants[0]?.id ? String(tenants[0].id) : "",
                        plan_tipo: "mensual",
                        monto: String(saasConfig.precio_mensual || "15.00"),
                        banco_origen: "Banco Pichincha",
                        numero_comprobante: "",
                        notas: "",
                      });
                      setManualModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Registrar Pago Manual</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Barra de Filtros de Solicitudes */}
            <div className="flex items-center justify-between flex-wrap gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-600" />
                <span className="font-bold text-sm">Bandeja de Pagos por Transferencia Bancaria</span>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-bold">
                {[
                  { id: "pendiente", label: `Pendientes (${pendientesCount})` },
                  { id: "aprobado", label: "Aprobados" },
                  { id: "rechazado", label: "Rechazados" },
                  { id: "", label: "Ver Todas" },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setFiltroSolEstado(s.id)}
                    className={`px-3 py-1.5 rounded-xl transition ${
                      filtroSolEstado === s.id
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Listado de Solicitudes de Transferencia */}
            <div className="space-y-4">
              {loadingSol ? (
                <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-2" />
                  <span>Consultando solicitudes y transferencias...</span>
                </div>
              ) : solicitudes.length === 0 ? (
                <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-60" />
                  <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
                    No hay solicitudes de transferencia en este estado.
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Cuando un negocio reporte su pago con comprobante, aparecerá aquí inmediatamente para aprobación.
                  </p>
                </div>
              ) : (
                solicitudes.map((sol) => (
                  <div
                    key={sol.id}
                    className={`p-5 rounded-2xl border transition bg-white dark:bg-slate-900 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5 ${
                      sol.estado === "pendiente"
                        ? "border-amber-300 dark:border-amber-800/80 bg-amber-50/20"
                        : sol.estado === "aprobado"
                        ? "border-slate-200 dark:border-slate-800"
                        : "border-red-200 dark:border-red-800/60 bg-red-50/10"
                    }`}
                  >
                    {/* Información del negocio y plan */}
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h4 className="font-black text-base text-slate-900 dark:text-white">
                          {sol.negocio_nombre}
                        </h4>
                        <span className="text-xs font-mono text-slate-400">/{sol.negocio_slug}</span>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            sol.estado === "pendiente"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300"
                              : sol.estado === "aprobado"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                          }`}
                        >
                          {sol.estado}
                        </span>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            sol.plan_tipo === "anual"
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200"
                              : "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200"
                          }`}
                        >
                          {sol.plan_tipo === "anual" ? "Paquete Anual (1 Año)" : "Plan Mensual (30 Días)"}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <div>
                          <strong>Dueño:</strong> {sol.dueno_nombre || "Admin"}
                        </div>
                        <div>
                          <strong>Email:</strong> {sol.dueno_email}
                        </div>
                        <div>
                          <strong>Teléfono:</strong> {sol.negocio_telefono || "Sin teléfono"}
                        </div>
                        <div>
                          <strong>Banco Origen:</strong>{" "}
                          <span className="font-bold text-slate-800 dark:text-slate-200">{sol.banco_origen}</span>
                        </div>
                        <div>
                          <strong>N° Comprobante:</strong>{" "}
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {sol.numero_comprobante}
                          </span>
                        </div>
                        <div>
                          <strong>Fecha Reportada:</strong> {sol.fecha_transferencia || sol.created_at.slice(0, 10)}
                        </div>
                      </div>

                      {sol.motivo_rechazo && (
                        <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-2 rounded-xl">
                          <strong>Motivo de rechazo:</strong> {sol.motivo_rechazo}
                        </p>
                      )}
                    </div>

                    {/* Monto y Comprobante */}
                    <div className="flex items-center gap-4">
                      {sol.comprobante_url ? (
                        <button
                          type="button"
                          onClick={() => setPreviewImgUrl(getAssetUrl(sol.comprobante_url))}
                          className="relative group w-20 h-20 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800 hover:ring-2 hover:ring-indigo-500 transition shadow-xs"
                          title="Clic para ver comprobante en grande"
                        >
                          <img
                            src={getAssetUrl(sol.comprobante_url)!}
                            alt="Comprobante de depósito"
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                            <Eye className="w-5 h-5" />
                          </div>
                        </button>
                      ) : (
                        <div className="w-20 h-20 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 text-[10px] text-center p-1 shrink-0">
                          <FileText className="w-5 h-5 mb-1 opacity-50" />
                          <span>Sin foto</span>
                        </div>
                      )}

                      <div className="text-right">
                        <span className="text-[11px] text-slate-400 font-bold uppercase block">Monto Pagado</span>
                        <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                          ${Number(sol.monto).toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">USD</span>
                      </div>
                    </div>

                    {/* Botones de Acción */}
                    {sol.estado === "pendiente" && (
                      <div className="flex sm:flex-col gap-2 shrink-0 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 pt-3 md:pt-0 md:pl-4">
                        <button
                          onClick={() => handleAprobarSolicitud(sol)}
                          className="flex-1 md:flex-none px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Aprobar & Activar</span>
                        </button>
                        <button
                          onClick={() => {
                            setRechazandoSol(sol);
                            setMotivoRechazo("");
                          }}
                          className="flex-1 md:flex-none px-4 py-2 rounded-xl border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950 text-red-600 font-bold text-xs transition"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Rechazar</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Historial de Pagos y Renovaciones (pagos_saas) */}
            <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>Historial de Renovaciones Aprobadas (Libro Diario SaaS)</span>
              </h3>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 text-[10px] uppercase font-bold">
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4">Negocio</th>
                      <th className="py-3 px-4">Días Añadidos</th>
                      <th className="py-3 px-4">Monto Cobrado</th>
                      <th className="py-3 px-4">Método</th>
                      <th className="py-3 px-4">Nueva Expiración</th>
                      <th className="py-3 px-4">Detalle / Notas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {pagosHistorico.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-400">
                          Aún no hay registros de pagos previos.
                        </td>
                      </tr>
                    ) : (
                      pagosHistorico.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">
                            {p.created_at.slice(0, 16)}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">
                            {p.negocio_nombre}
                          </td>
                          <td className="py-2.5 px-4 font-black text-indigo-600">
                            +{p.dias_agregados} días
                          </td>
                          <td className="py-2.5 px-4 font-black text-emerald-600">
                            ${Number(p.monto).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-4 font-semibold uppercase text-[10px] text-slate-600 dark:text-slate-300">
                            {p.metodo_pago}
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-slate-700 dark:text-slate-300">
                            {p.fecha_expiracion_nueva}
                          </td>
                          <td className="py-2.5 px-4 text-slate-500 text-[11px] max-w-xs truncate">
                            {p.notas || "Renovación"}
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
        {/* PESTAÑA 3: CONFIGURACIÓN SAAS & TARIFAS                                   */}
        {/* ========================================================================= */}
        {tabActiva === "configuracion" && (
          <div className="max-w-3xl space-y-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2.5 py-1 rounded-md">
                  Precios y Cuentas Bancarias
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mt-2">
                  Configuración de Tarifas de Suscripción & Datos de Pago
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Estos valores y cuentas bancarias son los que se mostrarán en la pantalla de vencimiento de los inquilinos y en su panel de administración para pagos por transferencia.
                </p>
              </div>

              <form onSubmit={handleSaveSaasConfig} className="space-y-5 text-xs">
                {/* Tarifas Mensual y Anual */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/50 space-y-2">
                    <label className="block font-bold text-indigo-900 dark:text-indigo-300">
                      Costo Plan Mensual ($ USD) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 font-bold text-slate-400">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        required
                        value={saasConfig.precio_mensual}
                        onChange={(e) =>
                          setSaasConfig({ ...saasConfig, precio_mensual: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full pl-7 pr-3 py-2 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 font-black text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 block">Renovación por 30 días</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/50 space-y-2">
                    <label className="block font-bold text-purple-900 dark:text-purple-300">
                      Paquete de Un Año ($ USD) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 font-bold text-slate-400">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        required
                        value={saasConfig.precio_anual}
                        onChange={(e) =>
                          setSaasConfig({ ...saasConfig, precio_anual: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full pl-7 pr-3 py-2 rounded-xl border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 font-black text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 block">Renovación anual por 365 días</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 space-y-2">
                    <label className="block font-bold text-emerald-900 dark:text-emerald-300">
                      Días de Prueba Inicial (Trial) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      required
                      value={saasConfig.dias_prueba}
                      onChange={(e) =>
                        setSaasConfig({ ...saasConfig, dias_prueba: parseInt(e.target.value) || 7 })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 font-black text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500 block">Días gratis para nuevos registros (7 días)</span>
                  </div>
                </div>

                {/* Cuentas Bancarias */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-slate-700 dark:text-slate-300">
                      Cuentas Bancarias Oficiales para Transferencias *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(saasConfig.datos_bancarios);
                        setCopiedBank(true);
                        setTimeout(() => setCopiedBank(false), 2000);
                      }}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-bold"
                    >
                      {copiedBank ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedBank ? "¡Copiado!" : "Copiar Texto"}</span>
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    required
                    placeholder="Banco Pichincha - Cuenta Corriente # 2100458921&#10;Titular: PymeWeb ERP S.A.S.&#10;RUC: 1793148921001&#10;Tipo: Transferencia Directa o Interbancaria"
                    value={saasConfig.datos_bancarios}
                    onChange={(e) => setSaasConfig({ ...saasConfig, datos_bancarios: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 block">
                    Especifica claramente banco, tipo de cuenta, número, RUC y titular para que los clientes hagan su transferencia sin dudas.
                  </span>
                </div>

                {/* WhatsApp y Email de Soporte */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      WhatsApp de Soporte / Pagos *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 0985559516"
                      value={saasConfig.whatsapp_soporte}
                      onChange={(e) => setSaasConfig({ ...saasConfig, whatsapp_soporte: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      A este número se enviarán las notificaciones de comprobante de los clientes.
                    </span>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Email de Soporte / Notificaciones
                    </label>
                    <input
                      type="email"
                      placeholder="Ej: soporte@pymeweb.com"
                      value={saasConfig.email_soporte}
                      onChange={(e) => setSaasConfig({ ...saasConfig, email_soporte: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Botón Guardar */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingConfig}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center gap-2 transition disabled:opacity-50"
                  >
                    {savingConfig ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Guardar Configuración SaaS</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
      </div>

      {/* MODAL 1: CREAR / EDITAR CLIENTE */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 space-y-4 shadow-2xl">
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              {editingTenant ? `Editar Inquilino: ${editingTenant.nombre}` : `Registrar Inquilino (${formData.dias_iniciales} días de prueba)`}
            </h2>

            <form onSubmit={handleSaveClient} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Nombre del Negocio *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: WebComp Computación"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs"
                  value={formData.nombre_negocio}
                  onChange={(e) => setFormData({ ...formData, nombre_negocio: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">RUC / Cédula</label>
                  <input
                    type="text"
                    placeholder="1002345678001"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs"
                    value={formData.ruc_nit}
                    onChange={(e) => setFormData({ ...formData, ruc_nit: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Teléfono</label>
                  <input
                    type="text"
                    placeholder="0991234567"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Nombre del Dueño *</label>
                  <input
                    type="text"
                    required
                    placeholder="Juan Pérez"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs"
                    value={formData.dueno_nombre}
                    onChange={(e) => setFormData({ ...formData, dueno_nombre: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Email del Dueño *</label>
                  <input
                    type="email"
                    required
                    placeholder="juan@empresa.com"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs"
                    value={formData.dueno_email}
                    onChange={(e) => setFormData({ ...formData, dueno_email: e.target.value })}
                  />
                </div>
              </div>

              {!editingTenant && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold mb-1">Contraseña Inicial *</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Días Iniciales</label>
                    <select
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                      value={formData.dias_iniciales}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          dias_iniciales: Number(e.target.value),
                          estado: Number(e.target.value) > 7 ? "activo" : "prueba",
                        })
                      }
                    >
                      <option value={7}>7 días (Prueba Gratuita)</option>
                      <option value={30}>30 días (Plan Mensual)</option>
                      <option value={180}>180 días (Semestral)</option>
                      <option value={365}>365 días (Paquete Anual)</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-600/20"
                >
                  {editingTenant ? "Guardar Cambios" : "Crear Inquilino"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REGISTRAR RENOVACIÓN MANUAL POR TRANSFERENCIA */}
      {manualModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  Registrar Renovación Manual por Transferencia
                </h3>
                <p className="text-xs text-slate-500">Activa o extiende la suscripción de un negocio directamente.</p>
              </div>
            </div>

            <form onSubmit={handleManualRenewalSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold mb-1">Selecciona el Negocio / Inquilino *</label>
                <select
                  required
                  value={manualForm.negocio_id}
                  onChange={(e) => setManualForm({ ...manualForm, negocio_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                >
                  <option value="">-- Elige un negocio --</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre} ({t.estado}) - Vence: {t.fecha_expiracion}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Plan a Activar *</label>
                  <select
                    value={manualForm.plan_tipo}
                    onChange={(e) => {
                      const tipo = e.target.value as "mensual" | "anual";
                      setManualForm({
                        ...manualForm,
                        plan_tipo: tipo,
                        monto: String(tipo === "anual" ? saasConfig.precio_anual : saasConfig.precio_mensual),
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                  >
                    <option value="mensual">Plan Mensual (+30 días)</option>
                    <option value="anual">Paquete Anual (+365 días)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1">Monto Cobrado ($ USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={manualForm.monto}
                    onChange={(e) => setManualForm({ ...manualForm, monto: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Banco de Origen</label>
                  <input
                    type="text"
                    placeholder="Ej: Banco Pichincha, Guayaquil, etc."
                    value={manualForm.banco_origen}
                    onChange={(e) => setManualForm({ ...manualForm, banco_origen: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">N° Comprobante / Depósito *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: DEP-489123"
                    value={manualForm.numero_comprobante}
                    onChange={(e) => setManualForm({ ...manualForm, numero_comprobante: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Notas / Referencia Adicional</label>
                <input
                  type="text"
                  placeholder="Ej: Pago verificado en banca empresas"
                  value={manualForm.notas}
                  onChange={(e) => setManualForm({ ...manualForm, notas: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setManualModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={processingManual}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
                >
                  {processingManual && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirmar & Activar Negocio</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RECHAZAR SOLICITUD */}
      {rechazandoSol && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-950 flex items-center justify-center">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">Rechazar Transferencia</h3>
                <p className="text-xs text-slate-500">Solicitud #{rechazandoSol.numero_comprobante}</p>
              </div>
            </div>

            <form onSubmit={handleRechazarSolicitud} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Motivo del rechazo *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Comprobante ilegible, monto no coincide, depósito no acreditado en cuenta..."
                  value={motivoRechazo}
                  onChange={(e) => setMotivoRechazo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setRechazandoSol(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-md shadow-red-600/20"
                >
                  Confirmar Rechazo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ENVIAR CREDENCIALES AL CLIENTE */}
      {credModalOpen && credModalData && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-6 border border-slate-200 dark:border-slate-800 space-y-5 shadow-2xl my-8 max-h-[95vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 shrink-0">
                  <Key className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900 dark:text-white leading-snug">
                    Credenciales de Acceso para el Cliente
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Envía el usuario, contraseña y enlaces de ingreso directamente al cliente.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCredModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Negocio</span>
                <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
                  {credModalData.negocio_nombre}
                </p>
                <p className="text-[11px] text-indigo-500 dark:text-indigo-400 font-mono">
                  Slug: /{credModalData.slug}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Dueño / Contacto</span>
                <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
                  {credModalData.dueno_nombre || "Sin especificar"}
                </p>
                <p className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                  <Phone className="w-3 h-3 text-emerald-500" />
                  <span>{credModalData.telefono || "Sin teléfono registrado"}</span>
                </p>
              </div>
            </div>

            {/* Credenciales Destacadas */}
            <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Datos de Inicio de Sesión</span>
                </span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-indigo-200/60 dark:bg-indigo-900/80 text-indigo-800 dark:text-indigo-200">
                  {credModalData.dias_restantes} días válidos
                </span>
              </div>

              {/* Usuario */}
              <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-indigo-100 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Usuario / Email</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white select-all">
                    {credModalData.dueno_email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(credModalData.dueno_email);
                    setFeedback("Usuario copiado al portapapeles.");
                  }}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Copiar usuario"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>

              {/* Contraseña */}
              <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-indigo-100 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Contraseña</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm select-all">
                    {credModalData.password || "(Sin mostrar - Encriptada en BD)"}
                  </span>
                </div>
                {credModalData.password ? (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(credModalData.password);
                      setCopiedPass(true);
                      setTimeout(() => setCopiedPass(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 rounded-lg bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800"
                  >
                    {copiedPass ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPass ? "¡Copiada!" : "Copiar"}</span>
                  </button>
                ) : null}
              </div>

              {/* Opción de asignar nueva contraseña rápida */}
              <div className="pt-2 border-t border-indigo-200/50 dark:border-indigo-900/50">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  {credModalData.password ? "Cambiar o restablecer contraseña:" : "Asignar nueva contraseña para compartir:"}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Escribe o genera una nueva contraseña"
                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setCustomPassword(generateRandomPassword())}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1 shrink-0"
                    title="Generar contraseña aleatoria"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Generar</span>
                  </button>
                  <button
                    type="button"
                    disabled={updatingPass || !customPassword || customPassword === credModalData.password}
                    onClick={() => handleUpdatePasswordAndRegenerate(customPassword)}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1 shadow-sm shrink-0"
                  >
                    {updatingPass ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Guardar</span>
                  </button>
                </div>
              </div>

              {/* Enlace de Ingreso */}
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 pt-1">
                <span className="font-medium">URL de Ingreso:</span>
                <div className="flex items-center gap-2">
                  <a
                    href={credModalData.login_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 font-mono underline hover:text-indigo-500 flex items-center gap-1"
                  >
                    <span>{credModalData.login_url}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* Vista previa del mensaje */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Mensaje listo para enviar al cliente:</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(credModalData.whatsapp_text);
                    setCopiedCred(true);
                    setTimeout(() => setCopiedCred(false), 2000);
                  }}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  {copiedCred ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCred ? "¡Mensaje Copiado!" : "Copiar Texto"}</span>
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] leading-relaxed text-slate-800 dark:text-slate-200 max-h-36 overflow-y-auto whitespace-pre-wrap select-all">
                {credModalData.whatsapp_text}
              </div>
            </div>

            {/* Email feedback status if any */}
            {emailStatus && (
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 text-xs font-medium text-blue-800 dark:text-blue-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>{emailStatus}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              {/* WhatsApp direct button */}
              <a
                href={credModalData.whatsapp_url}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 transition text-center"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Enviar por WhatsApp al Cliente</span>
              </a>

              {/* Send by Email button */}
              <button
                type="button"
                disabled={sendingEmail}
                onClick={handleSendCredentialsEmail}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-md shadow-indigo-600/20 transition"
                title="Enviar por correo electrónico"
              >
                {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                <span>{sendingEmail ? "Enviando..." : "Enviar por Correo"}</span>
              </button>

              {/* Close button */}
              <button
                type="button"
                onClick={() => setCredModalOpen(false)}
                className="w-full sm:w-auto px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: ZOOM DE COMPROBANTE DE TRANSFERENCIA */}
      {previewImgUrl && (
        <div
          onClick={() => setPreviewImgUrl(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-2xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-700 relative p-2"
          >
            <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-800">
              <span className="font-bold text-xs flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>Comprobante de Transferencia Bancaria</span>
              </span>
              <button
                onClick={() => setPreviewImgUrl(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 font-bold"
              >
                ✕
              </button>
            </div>
            <div className="p-2 overflow-auto max-h-[75vh] flex items-center justify-center bg-slate-950">
              <img
                src={previewImgUrl}
                alt="Comprobante completo"
                className="max-w-full max-h-[70vh] object-contain rounded-xl"
              />
            </div>
            <div className="p-3 text-right border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs">
              <a
                href={previewImgUrl}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Abrir imagen original
              </a>
              <button
                onClick={() => setPreviewImgUrl(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 font-bold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
