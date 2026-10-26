"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  Truck,
  PackageCheck,
  XCircle,
  Search,
  ExternalLink,
  Settings,
  Eye,
  FileCheck2,
  DollarSign,
  User,
  Phone,
  MapPin,
  Calendar,
  AlertCircle,
  Copy,
  Check,
  Building2,
  Loader2,
  Send,
  X,
  BookOpen,
  Printer,
  Navigation,
  Share2,
  Bike,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface PedidoWeb {
  id: number;
  numero_pedido: string;
  cliente_nombre: string;
  cliente_documento: string;
  cliente_telefono: string;
  cliente_email: string;
  cliente_ciudad: string;
  cliente_direccion: string;
  ubicacion_gps?: string | null;
  metodo_pago: "transferencia" | "tarjeta" | "contra_entrega";
  comprobante_pago_url: string | null;
  subtotal: string | number;
  costo_envio: string | number;
  impuesto: string | number;
  total: string | number;
  estado: "pendiente" | "confirmado" | "enviado" | "entregado" | "cancelado";
  tipo_despacho?: "motorizado" | "empresa" | null;
  motorizado_nombre?: string | null;
  motorizado_telefono?: string | null;
  courier_nombre?: string | null;
  courier_telefono?: string | null;
  guia_envio?: string | null;
  notas?: string | null;
  venta_id: number | null;
  asiento_id: number | null;
  factura_id: number | null;
  items_count: number;
  created_at: string;
}

interface MetricasWeb {
  total_pedidos: number;
  pendientes_count: number;
  pendientes_monto: string | number;
  confirmados_count: number;
  confirmados_monto: string | number;
  enviados_count: number;
  entregados_count: number;
  entregados_monto: string | number;
  cancelados_count: number;
}

interface ConfigTienda {
  slug: string;
  descripcion: string | null;
  datos_bancarios: string | null;
  telefono: string | null;
  whatsapp_contacto: string | null;
  ciudad?: string | null;
  costo_envio_fijo: string | number;
  costo_envio_local?: string | number;
  costo_envio_nacional?: string | number;
  tienda_online_activa: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost/pymeweb/backend-api/api";

function getAssetUrl(url?: string | null) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = API_BASE.replace(/\/api\/?$/, "");
  return `${base}/${url.replace(/^\//, "")}`;
}

export default function PedidosWebDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState<PedidoWeb[]>([]);
  const [metricas, setMetricas] = useState<MetricasWeb | null>(null);
  const [configTienda, setConfigTienda] = useState<ConfigTienda | null>(null);

  // Filtros
  const [estadoFiltro, setEstadoFiltro] = useState<string>("todos");
  const [busqueda, setBusqueda] = useState<string>("");

  // Modales
  const [detallePedido, setDetallePedido] = useState<any | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [comprobanteModalUrl, setComprobanteModalUrl] = useState<string | null>(null);

  // Modal Configuración de Tienda
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [configForm, setConfigForm] = useState({
    descripcion: "",
    datos_bancarios: "",
    telefono: "",
    whatsapp_contacto: "",
    ciudad: "Ibarra",
    costo_envio_fijo: "0.00",
    costo_envio_local: "2.00",
    costo_envio_nacional: "5.00",
    tienda_online_activa: 1,
  });

  // Modal Cancelación
  const [cancelingId, setCancelingId] = useState<number | null>(null);
  const [motivoCancelacion, setMotivoCancelacion] = useState("");
  const [processingCancel, setProcessingCancel] = useState(false);

  // Modal de Despacho y Envío al Repartidor / Courier
  const [despachoPedido, setDespachoPedido] = useState<PedidoWeb | null>(null);
  const [tipoDespacho, setTipoDespacho] = useState<"motorizado" | "empresa">("motorizado");
  const [motorizadoNombre, setMotorizadoNombre] = useState("");
  const [motorizadoTelefono, setMotorizadoTelefono] = useState("");
  const [courierNombre, setCourierNombre] = useState("");
  const [courierTelefono, setCourierTelefono] = useState("");
  const [guiaEnvio, setGuiaEnvio] = useState("");
  const [copiedDelivery, setCopiedDelivery] = useState(false);
  const [copiedCourierInfo, setCopiedCourierInfo] = useState(false);
  const [savingDespacho, setSavingDespacho] = useState(false);

  // Paginación (10 pedidos por página)
  const [paginaActual, setPaginaActual] = useState(1);
  const [paginacion, setPaginacion] = useState({
    total: 0,
    page: 1,
    limit: 10,
    total_pages: 1,
  });

  // Acciones en progreso
  const [actionId, setActionId] = useState<number | null>(null);
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchPedidos = async (newPage?: number) => {
    try {
      setLoading(true);
      const targetPage = newPage !== undefined ? newPage : paginaActual;
      const q = new URLSearchParams();
      if (estadoFiltro !== "todos") q.set("estado", estadoFiltro);
      if (busqueda.trim()) q.set("busqueda", busqueda.trim());
      q.set("page", String(targetPage));
      q.set("limit", "10");

      const res = await apiFetch(`/tenant/web-orders.php?${q.toString()}`);
      if (res.success) {
        setPedidos(res.pedidos || []);
        setMetricas(res.metricas || null);
        if (res.paginacion) {
          setPaginacion(res.paginacion);
          setPaginaActual(res.paginacion.page);
        }
        if (res.config_tienda) {
          setConfigTienda(res.config_tienda);
          setConfigForm({
            descripcion: res.config_tienda.descripcion || "",
            datos_bancarios: res.config_tienda.datos_bancarios || "",
            telefono: res.config_tienda.telefono || "",
            whatsapp_contacto: res.config_tienda.whatsapp_contacto || res.config_tienda.telefono || "",
            ciudad: res.config_tienda.ciudad || "Ibarra",
            costo_envio_fijo: String(res.config_tienda.costo_envio_fijo || "0.00"),
            costo_envio_local: String(res.config_tienda.costo_envio_local ?? "2.00"),
            costo_envio_nacional: String(res.config_tienda.costo_envio_nacional ?? "5.00"),
            tienda_online_activa: Number(res.config_tienda.tienda_online_activa) ? 1 : 0,
          });
        }
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPedidos(1);
  }, [estadoFiltro]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPedidos(1);
  };

  // Ver detalle
  const openDetalle = async (id: number) => {
    setLoadingDetalle(true);
    try {
      const res = await apiFetch(`/tenant/web-orders.php?id=${id}`);
      if (res.success) {
        setDetallePedido(res.pedido);
      }
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Error al cargar detalle del pedido." });
    } finally {
      setLoadingDetalle(false);
    }
  };

  // Confirmar pago (Promueve borrador a mayorizado y emite Factura SRI)
  const handleConfirmarPago = async (id: number) => {
    if (!confirm("¿Deseas confirmar el pago de este pedido? Se completará la venta, se mayorizará el asiento contable en el Libro Diario y se emitirá la Factura Electrónica legal del SRI.")) {
      return;
    }

    setActionId(id);
    try {
      const res = await apiFetch("/tenant/web-orders.php?action=confirmar", {
        method: "POST",
        body: JSON.stringify({ id }),
      });

      if (res.success) {
        setAlertMsg({
          type: "success",
          text: `${res.mensaje} ${res.sri_detalle ? `(${res.sri_detalle})` : ""}`,
        });
        fetchPedidos();
        if (detallePedido?.id === id) {
          openDetalle(id);
        }
      }
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Error al confirmar el pedido." });
    } finally {
      setActionId(null);
    }
  };

  // Cambiar estado a Enviado / Entregado
  const handleCambiarEstado = async (id: number, nuevoEstado: "enviado" | "entregado") => {
    setActionId(id);
    try {
      const res = await apiFetch("/tenant/web-orders.php?action=cambiar_estado", {
        method: "POST",
        body: JSON.stringify({ id, nuevo_estado: nuevoEstado }),
      });

      if (res.success) {
        setAlertMsg({ type: "success", text: res.mensaje });
        fetchPedidos();
        if (detallePedido?.id === id) {
          openDetalle(id);
        }
      }
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message });
    } finally {
      setActionId(null);
    }
  };

  // Cancelar Pedido (Restituye stock y reversa contabilidad)
  const handleCancelarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelingId) return;

    setProcessingCancel(true);
    try {
      const res = await apiFetch("/tenant/web-orders.php?action=cancelar", {
        method: "POST",
        body: JSON.stringify({ id: cancelingId, motivo: motivoCancelacion }),
      });

      if (res.success) {
        setAlertMsg({ type: "success", text: res.mensaje });
        setCancelingId(null);
        setMotivoCancelacion("");
        fetchPedidos();
        if (detallePedido?.id === cancelingId) {
          openDetalle(cancelingId);
        }
      }
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Error al cancelar pedido." });
    } finally {
      setProcessingCancel(false);
    }
  };

  // Guardar configuración de tienda
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await apiFetch("/tenant/web-orders.php?action=actualizar_tienda", {
        method: "POST",
        body: JSON.stringify(configForm),
      });

      if (res.success) {
        setAlertMsg({ type: "success", text: res.mensaje });
        setIsConfigOpen(false);
        fetchPedidos();
      }
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message });
    } finally {
      setSavingConfig(false);
    }
  };

  const copyStoreLink = () => {
    if (!configTienda?.slug) return;
    const url = `${window.location.origin}/${configTienda.slug}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const getStatusBadge = (estado: string) => {
    switch (estado) {
      case "pendiente":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
            <Clock className="w-3.5 h-3.5" /> Pendiente Pago
          </span>
        );
      case "confirmado":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
            <CheckCircle2 className="w-3.5 h-3.5" /> Confirmado
          </span>
        );
      case "enviado":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800/60">
            <Truck className="w-3.5 h-3.5" /> En Envío
          </span>
        );
      case "entregado":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
            <PackageCheck className="w-3.5 h-3.5" /> Entregado
          </span>
        );
      case "cancelado":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/60">
            <XCircle className="w-3.5 h-3.5" /> Cancelado
          </span>
        );
      default:
        return null;
    }
  };

  const openDespachoModal = (ped: PedidoWeb) => {
    setDespachoPedido(ped);
    setTipoDespacho(ped.tipo_despacho || "motorizado");
    setMotorizadoNombre(ped.motorizado_nombre || "");
    const savedMotoPhone = typeof window !== "undefined" ? localStorage.getItem("last_motorizado_phone") || "" : "";
    setMotorizadoTelefono(ped.motorizado_telefono || savedMotoPhone);
    setCourierNombre(ped.courier_nombre || "");
    const savedCourierPhone = typeof window !== "undefined" ? localStorage.getItem("last_courier_phone") || "" : "";
    setCourierTelefono(ped.courier_telefono || savedCourierPhone);
    setGuiaEnvio(ped.guia_envio || "");
    setCopiedDelivery(false);
    setCopiedCourierInfo(false);
  };

  const handleSendToDriverWhatsApp = () => {
    if (!despachoPedido) return;
    if (motorizadoTelefono.trim()) {
      try {
        localStorage.setItem("last_motorizado_phone", motorizadoTelefono.trim());
      } catch (_) {}
    }

    const cobrarTexto =
      despachoPedido.metodo_pago === "contra_entrega"
        ? `⚠️ *COBRAR AL CLIENTE:* $${Number(despachoPedido.total).toFixed(2)} (Pago Contra Entrega en Efectivo)`
        : `✅ *YA PAGADO* ($0.00 a cobrar al cliente)`;

    const mapsUrl =
      despachoPedido.ubicacion_gps ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${despachoPedido.cliente_direccion}, ${despachoPedido.cliente_ciudad}, Ecuador`
      )}`;

    const text = `🛵 *ORDEN DE ENTREGA / REPARTIDOR*
📦 *Pedido:* #${despachoPedido.numero_pedido}
👤 *Cliente:* ${despachoPedido.cliente_nombre}
📞 *Teléfono Cliente:* ${despachoPedido.cliente_telefono}
📍 *Ciudad:* ${despachoPedido.cliente_ciudad}
🏠 *Dirección:* ${despachoPedido.cliente_direccion}
💰 *Total / Cobro:* ${cobrarTexto}
📝 *Indicaciones/Notas:* ${despachoPedido.notas || "Ninguna"}
🗺️ *Ruta Google Maps / GPS:* ${mapsUrl}`;

    let phoneClean = motorizadoTelefono.replace(/\D/g, "");
    if (phoneClean.startsWith("09") && phoneClean.length === 10) {
      phoneClean = "593" + phoneClean.substring(1);
    }

    const url = phoneClean
      ? `https://wa.me/${phoneClean}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const handleSendToCourierWhatsApp = () => {
    if (!despachoPedido) return;
    if (courierTelefono.trim()) {
      try {
        localStorage.setItem("last_courier_phone", courierTelefono.trim());
      } catch (_) {}
    }

    const cobrarTexto =
      despachoPedido.metodo_pago === "contra_entrega"
        ? `⚠️ *COBRAR AL CLIENTE EN DESTINO:* $${Number(despachoPedido.total).toFixed(2)} (Contra Entrega)`
        : `✅ *ENVÍO PAGADO* ($0.00 a cobrar al cliente)`;

    const mapsUrl =
      despachoPedido.ubicacion_gps ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${despachoPedido.cliente_direccion}, ${despachoPedido.cliente_ciudad}, Ecuador`
      )}`;

    const text = `📦 *DATOS DE ENVÍO Y DESPACHO - ${courierNombre.toUpperCase() || "COURIER / ENCOMIENDA"}*
📋 *Orden / Pedido:* #${despachoPedido.numero_pedido}

🏢 *REMITENTE (Origen):*
• Ciudad Origen: ${configTienda?.ciudad || "Ibarra"}
• Teléfono Remitente: ${configTienda?.whatsapp_contacto || configTienda?.telefono || ""}

👤 *DESTINATARIO (Entrega):*
• Nombre: ${despachoPedido.cliente_nombre}
• Cédula/RUC: ${despachoPedido.cliente_documento}
• Teléfono: ${despachoPedido.cliente_telefono}
• Ciudad de Destino: ${despachoPedido.cliente_ciudad}
• Dirección de Entrega: ${despachoPedido.cliente_direccion}
• Referencias: ${despachoPedido.notas || "Ninguna"}
• Ubicación GPS: ${mapsUrl}

💰 *Condición de Cobro:* ${cobrarTexto}
${guiaEnvio ? `🔖 *N° de Guía:* ${guiaEnvio}\n` : ""}
Por favor confirmar recepción y generación de guía.`;

    let phoneClean = courierTelefono.replace(/\D/g, "");
    if (phoneClean.startsWith("09") && phoneClean.length === 10) {
      phoneClean = "593" + phoneClean.substring(1);
    }

    const url = phoneClean
      ? `https://wa.me/${phoneClean}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const handleCopyCourierInfo = () => {
    if (!despachoPedido) return;
    const cobrarTexto =
      despachoPedido.metodo_pago === "contra_entrega"
        ? `COBRAR EN DESTINO: $${Number(despachoPedido.total).toFixed(2)} (Contra Entrega)`
        : `PAGADO ($0.00)`;

    const mapsUrl =
      despachoPedido.ubicacion_gps ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${despachoPedido.cliente_direccion}, ${despachoPedido.cliente_ciudad}, Ecuador`
      )}`;

    const text = `*DATOS PARA EMPRESA / COURIER (${courierNombre || "Courier"})*
Pedido: #${despachoPedido.numero_pedido}
Origen: ${configTienda?.ciudad || "Ibarra"}

--- DATOS DEL DESTINATARIO ---
Destinatario: ${despachoPedido.cliente_nombre}
C.I. / RUC: ${despachoPedido.cliente_documento}
Teléfono: ${despachoPedido.cliente_telefono}
Ciudad Destino: ${despachoPedido.cliente_ciudad}
Dirección: ${despachoPedido.cliente_direccion}
Referencias: ${despachoPedido.notas || "Ninguna"}
Cobro: ${cobrarTexto}
${guiaEnvio ? `N° Guía: ${guiaEnvio}\n` : ""}Ubicación GPS: ${mapsUrl}`;

    navigator.clipboard.writeText(text);
    setCopiedCourierInfo(true);
    setTimeout(() => setCopiedCourierInfo(false), 2000);
  };

  const handleSendTrackingToCustomer = () => {
    if (!despachoPedido) return;
    const storeName = configTienda?.slug ? "la tienda online" : "nuestra tienda";
    const text = `Hola *${despachoPedido.cliente_nombre}*, te saludamos de ${storeName}.\n📦 Te informamos que tu pedido *#${despachoPedido.numero_pedido}* ya ha sido despachado a través de *${courierNombre || "Courier"}*.\n🚚 *Número de Guía / Rastreo:* ${guiaEnvio || "En camino"}\n¡Muchas gracias por tu compra!`;

    let phoneClean = (despachoPedido.cliente_telefono || "").replace(/\D/g, "");
    if (phoneClean.startsWith("09") && phoneClean.length === 10) {
      phoneClean = "593" + phoneClean.substring(1);
    }

    const url = phoneClean
      ? `https://wa.me/${phoneClean}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const handleCopyDeliveryInfo = () => {
    if (!despachoPedido) return;
    const cobrarTexto =
      despachoPedido.metodo_pago === "contra_entrega"
        ? `COBRAR: $${Number(despachoPedido.total).toFixed(2)} (Contra Entrega)`
        : `PAGADO ($0.00)`;

    const mapsUrl =
      despachoPedido.ubicacion_gps ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${despachoPedido.cliente_direccion}, ${despachoPedido.cliente_ciudad}, Ecuador`
      )}`;

    const text = `*ENTREGA DE PEDIDO #${despachoPedido.numero_pedido}*
Cliente: ${despachoPedido.cliente_nombre}
Teléfono: ${despachoPedido.cliente_telefono}
Dirección: ${despachoPedido.cliente_direccion}, ${despachoPedido.cliente_ciudad}
Cobro: ${cobrarTexto}
Notas: ${despachoPedido.notas || "Ninguna"}
Ubicación / GPS: ${mapsUrl}`;

    navigator.clipboard.writeText(text);
    setCopiedDelivery(true);
    setTimeout(() => setCopiedDelivery(false), 2000);
  };

  const handleSaveDespacho = async (cambiarAEnviado: boolean) => {
    if (!despachoPedido) return;
    setSavingDespacho(true);
    try {
      const res = await apiFetch("/tenant/web-orders.php?action=cambiar_estado", {
        method: "POST",
        body: JSON.stringify({
          id: despachoPedido.id,
          nuevo_estado: cambiarAEnviado ? "enviado" : despachoPedido.estado,
          tipo_despacho: tipoDespacho,
          motorizado_nombre: tipoDespacho === "motorizado" ? motorizadoNombre.trim() : null,
          motorizado_telefono: tipoDespacho === "motorizado" ? motorizadoTelefono.trim() : null,
          courier_nombre: tipoDespacho === "empresa" ? courierNombre.trim() : null,
          courier_telefono: tipoDespacho === "empresa" ? courierTelefono.trim() : null,
          guia_envio: tipoDespacho === "empresa" ? guiaEnvio.trim() : null,
        }),
      });

      if (res.success) {
        setAlertMsg({ type: "success", text: res.mensaje || "Datos de envío guardados correctamente." });
        fetchPedidos();
        if (detallePedido?.id === despachoPedido.id) {
          openDetalle(despachoPedido.id);
        }
        setDespachoPedido(null);
      }
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Error al actualizar despacho." });
    } finally {
      setSavingDespacho(false);
    }
  };

  const printShippingLabel = (ped: any) => {
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

    const negocioNombre = ped.negocio?.nombre || "Tienda Virtual";
    const negocioRuc = ped.negocio?.ruc_nit || "";
    const negocioTel = ped.negocio?.telefono || configTienda?.whatsapp_contacto || configTienda?.telefono || "";
    const negocioDir = ped.negocio?.direccion || "";

    const cobrarTexto =
      ped.metodo_pago === "contra_entrega"
        ? `⚠️ COBRAR EN EFECTIVO: $${Number(ped.total).toFixed(2)}`
        : `✅ PAGADO / NO COBRAR ($0.00)`;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Rótulo de Envío - ${ped.numero_pedido}</title>
          <meta charset="utf-8">
          <style>
            @page { size: 100mm 150mm; margin: 5mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: Arial, -apple-system, sans-serif;
              color: #000;
              background: #fff;
              font-size: 11px;
              line-height: 1.35;
              padding: 4px;
            }
            .header {
              border-bottom: 2px solid #000;
              padding-bottom: 6px;
              margin-bottom: 8px;
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .store-name { font-size: 13px; font-weight: 900; text-transform: uppercase; }
            .badge {
              border: 2px solid #000;
              font-weight: 900;
              padding: 3px 6px;
              font-size: 11px;
              text-transform: uppercase;
              border-radius: 4px;
              background: #000;
              color: #fff;
            }
            .section {
              border: 1.5px solid #000;
              border-radius: 6px;
              padding: 8px;
              margin-bottom: 8px;
            }
            .section-title {
              font-size: 9px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #222;
              margin-bottom: 4px;
              border-bottom: 1px dashed #aaa;
              padding-bottom: 2px;
            }
            .destinatario-name { font-size: 14px; font-weight: 900; margin-bottom: 3px; }
            .address-box {
              background: #f1f5f9;
              border: 1px solid #cbd5e1;
              padding: 7px;
              font-size: 12px;
              font-weight: bold;
              margin: 5px 0;
              border-radius: 4px;
              line-height: 1.3;
            }
            .payment-alert {
              border: 2px solid #000;
              background: #fef08a;
              color: #000;
              padding: 8px;
              text-align: center;
              font-size: 12px;
              font-weight: 900;
              border-radius: 4px;
              margin-top: 6px;
              text-transform: uppercase;
            }
            .footer-notes { font-size: 9px; color: #64748b; text-align: center; margin-top: 8px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="store-name">${negocioNombre}</div>
              <div style="font-size:9px;">RUC: ${negocioRuc} • Tel: ${negocioTel}</div>
              <div style="font-size:9px;">Origen: ${negocioDir || "Ecuador"}</div>
            </div>
            <div class="badge">#${ped.numero_pedido}</div>
          </div>

          <div class="section">
            <div class="section-title">📦 DESTINATARIO / ENTREGA A:</div>
            <div class="destinatario-name">${ped.cliente_nombre}</div>
            <div><strong>Cédula / RUC:</strong> ${ped.cliente_documento}</div>
            <div><strong>Teléfono / Celular:</strong> ${ped.cliente_telefono}</div>
            <div><strong>Ciudad:</strong> ${ped.cliente_ciudad}</div>
            <div class="address-box">
              DIRECCIÓN EXACTA DE ENTREGA:<br>
              ${ped.cliente_direccion}
            </div>
            ${ped.notas ? `<div style="font-size:10px; margin-top:4px;"><strong>Indicaciones / Notas:</strong> ${ped.notas}</div>` : ""}
          </div>

          <div class="section">
            <div class="section-title">🚚 DATOS LOGÍSTICOS & COBRO:</div>
            <div><strong>Fecha:</strong> ${new Date(ped.created_at).toLocaleDateString("es-EC")}</div>
            <div><strong>Courier / Repartidor:</strong> ${ped.courier_nombre || "Entrega local / Motorizado"}</div>
            ${ped.guia_envio ? `<div><strong>Guía / Rastreo:</strong> ${ped.guia_envio}</div>` : ""}
            <div class="payment-alert">${cobrarTexto}</div>
          </div>

          <div class="footer-notes">
            Despachado desde PymeWeb ERP • Tienda Online
          </div>
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
    <div className="space-y-6">
      {/* 1. HEADER & ACTIONS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-100/70 dark:bg-indigo-950/60 px-3 py-1 rounded-full mb-2">
            <ShoppingBag className="w-3.5 h-3.5" /> Canal Storefront B2C
          </span>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Pedidos de Tienda Online
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Recepción, validación de comprobantes, mayorización contable automática y facturación electrónica SRI.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {configTienda?.slug && (
            <Link
              href={`/${configTienda.slug}`}
              target="_blank"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition shadow-sm"
            >
              <span>Ver Tienda Pública</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}

          <button
            onClick={() => setIsConfigOpen(true)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition"
          >
            <Settings className="w-4 h-4" />
            <span>Configurar Tienda</span>
          </button>
        </div>
      </div>

      {/* BANNER DESTACADO: CANAL DE PEDIDOS WHATSAPP & TIENDA VIRTUAL */}
      <div className="bg-gradient-to-r from-indigo-500/10 via-emerald-500/10 to-indigo-500/10 dark:from-indigo-950/40 dark:via-emerald-950/30 dark:to-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 rounded-3xl p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/30">
            <Phone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-extrabold text-sm md:text-base text-slate-900 dark:text-white">
                Recepción de Pedidos Tienda Virtual
              </h2>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                Number(configTienda?.tienda_online_activa) ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400" : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              }`}>
                {Number(configTienda?.tienda_online_activa) ? "Tienda Activa" : "En Mantenimiento"}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Teléfono / WhatsApp para recibir pedidos:{" "}
              <strong className="text-emerald-700 dark:text-emerald-400 font-mono text-xs md:text-sm">
                {configTienda?.whatsapp_contacto || configTienda?.telefono || "Sin registrar"}
              </strong>
              {!(configTienda?.whatsapp_contacto || configTienda?.telefono) && (
                <span className="text-amber-600 dark:text-amber-400 font-medium ml-1">
                  (¡Regístralo para que tus clientes te envíen pedidos por WhatsApp!)
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {configTienda?.slug && (
            <button
              onClick={copyStoreLink}
              type="button"
              className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? "¡Enlace Copiado!" : "Copiar Enlace"}</span>
            </button>
          )}

          <button
            onClick={() => setIsConfigOpen(true)}
            type="button"
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm shadow-emerald-600/20"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>{configTienda?.whatsapp_contacto || configTienda?.telefono ? "Cambiar Teléfono" : "Registrar Teléfono"}</span>
          </button>
        </div>
      </div>

      {/* ALERT FEEDBACK */}
      {alertMsg && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between text-xs font-medium border ${
            alertMsg.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {alertMsg.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{alertMsg.text}</span>
          </div>
          <button onClick={() => setAlertMsg(null)} className="opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. KPI METRICS CARDS */}
      {metricas && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Total Pedidos</span>
              <ShoppingBag className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {metricas.total_pedidos}
            </div>
            <span className="text-[11px] text-slate-400">Canal Online B2C</span>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 shadow-xs">
            <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Por Confirmar</span>
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-amber-700 dark:text-amber-400">
              {metricas.pendientes_count}
            </div>
            <span className="text-[11px] font-bold text-amber-600/80">
              ${Number(metricas.pendientes_monto).toFixed(2)} por cobrar
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40 shadow-xs">
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Pagados / Confirmados</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
              {metricas.confirmados_count}
            </div>
            <span className="text-[11px] font-bold text-emerald-600/80">
              ${Number(metricas.confirmados_monto).toFixed(2)} recaudados
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-800/40 shadow-xs">
            <div className="flex items-center justify-between text-blue-700 dark:text-blue-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Entregados</span>
              <PackageCheck className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-blue-700 dark:text-blue-400">
              {metricas.entregados_count}
            </div>
            <span className="text-[11px] font-bold text-blue-600/80">
              ${Number(metricas.entregados_monto).toFixed(2)} entregados
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Cancelados</span>
              <XCircle className="w-4 h-4 text-red-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {metricas.cancelados_count}
            </div>
            <span className="text-[11px] text-slate-400">Stock restituido</span>
          </div>
        </div>
      )}

      {/* 3. FILTROS Y BUSCADOR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { id: "todos", label: "Todos" },
            { id: "pendiente", label: "Pendientes" },
            { id: "confirmado", label: "Confirmados" },
            { id: "enviado", label: "Enviados" },
            { id: "entregado", label: "Entregados" },
            { id: "cancelado", label: "Cancelados" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setEstadoFiltro(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                estadoFiltro === tab.id
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearchSubmit} className="relative sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por N° Pedido, cliente o cédula..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </form>
      </div>

      {/* 4. ORDERS TABLE / LIST */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
            <p className="text-xs font-semibold">Cargando pedidos de la tienda online...</p>
          </div>
        ) : pedidos.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <ShoppingBag className="w-12 h-12 stroke-1 mx-auto mb-3 opacity-30" />
            <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">No hay pedidos web en este filtro</h4>
            <p className="text-xs text-slate-500 mt-1">
              Los nuevos pedidos que tus clientes hagan en la tienda web aparecerán aquí en tiempo real.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 font-black text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Pedido / Fecha</th>
                  <th className="py-3.5 px-4">Cliente / Contacto</th>
                  <th className="py-3.5 px-4">Dirección de Entrega</th>
                  <th className="py-3.5 px-4">Método & Pago</th>
                  <th className="py-3.5 px-4">Total</th>
                  <th className="py-3.5 px-4">Estado</th>
                  <th className="py-3.5 px-4">Contabilidad / SRI</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {pedidos.map((ped) => {
                  const isProcessing = actionId === ped.id;

                  return (
                    <tr key={ped.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      {/* Pedido / Fecha */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs block">
                          {ped.numero_pedido}
                        </span>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          {new Date(ped.created_at).toLocaleDateString("es-EC", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </td>

                      {/* Cliente */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 dark:text-slate-100 block truncate max-w-[160px]">
                          {ped.cliente_nombre}
                        </span>
                        <span className="text-[11px] text-slate-500 block">
                          CI/RUC: {ped.cliente_documento}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <a
                            href={`https://wa.me/${ped.cliente_telefono.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-0.5 font-bold"
                          >
                            <Phone className="w-3 h-3" /> {ped.cliente_telefono}
                          </a>
                        </div>
                      </td>

                      {/* Dirección de Entrega & Despacho */}
                      <td className="py-3.5 px-4 min-w-[200px] max-w-[260px]">
                        <div className="flex items-start gap-1.5 text-slate-800 dark:text-slate-200">
                          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold block text-xs line-clamp-2" title={ped.cliente_direccion}>
                              {ped.cliente_direccion || "Sin dirección registrada"}
                            </span>
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mt-0.5">
                              📍 {ped.cliente_ciudad}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {ped.ubicacion_gps ? (
                            <a
                              href={ped.ubicacion_gps}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 hover:underline bg-emerald-100/70 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md"
                              title="Ubicación GPS exacta del cliente"
                            >
                              <Navigation className="w-3 h-3 text-emerald-600" /> GPS Exacto
                            </a>
                          ) : ped.cliente_direccion ? (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                `${ped.cliente_direccion}, ${ped.cliente_ciudad}, Ecuador`
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md"
                            >
                              <Navigation className="w-3 h-3" /> Ver Mapa
                            </a>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => openDespachoModal(ped)}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-400 hover:underline bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md"
                          >
                            <Send className="w-3 h-3" /> Despacho
                          </button>
                        </div>

                        {ped.tipo_despacho === "motorizado" && ped.motorizado_nombre ? (
                          <div className="mt-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md w-fit flex items-center gap-1">
                            <Bike className="w-3 h-3" /> Motorizado: {ped.motorizado_nombre}
                          </div>
                        ) : ped.courier_nombre ? (
                          <div className="mt-1 text-[10px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded-md w-fit flex items-center gap-1">
                            <Truck className="w-3 h-3" /> {ped.courier_nombre} {ped.guia_envio ? `• Guía: ${ped.guia_envio}` : ""}
                          </div>
                        ) : null}
                      </td>

                      {/* Método & Comprobante */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-semibold capitalize text-slate-700 dark:text-slate-300 block">
                          {ped.metodo_pago === "contra_entrega" ? "Contra Entrega" : ped.metodo_pago}
                        </span>
                        {ped.comprobante_pago_url ? (
                          <button
                            onClick={() => setComprobanteModalUrl(getAssetUrl(ped.comprobante_pago_url)!)}
                            className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md"
                          >
                            <Eye className="w-3 h-3" /> Ver Comprobante
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic block mt-0.5">
                            {ped.metodo_pago === "contra_entrega" ? "Cobrar al entregar" : "Sin comprobante"}
                          </span>
                        )}
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-black text-sm text-slate-900 dark:text-white block">
                          ${Number(ped.total).toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {ped.items_count} producto{ped.items_count !== 1 ? "s" : ""}
                        </span>
                      </td>

                      {/* Estado */}
                      <td className="py-3.5 px-4 whitespace-nowrap">{getStatusBadge(ped.estado)}</td>

                      {/* Contabilidad / SRI */}
                      <td className="py-3.5 px-4 space-y-1 whitespace-nowrap">
                        {ped.asiento_id ? (
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              ped.estado === "pendiente"
                                ? "bg-amber-100/70 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                : ped.estado === "cancelado"
                                ? "bg-red-100/70 text-red-800 dark:bg-red-950/60 dark:text-red-300"
                                : "bg-emerald-100/70 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            }`}
                          >
                            <BookOpen className="w-3 h-3" />
                            {ped.estado === "pendiente"
                              ? "Asiento Borrador"
                              : ped.estado === "cancelado"
                              ? "Asiento Anulado"
                              : "Asiento Mayorizado"}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 block">-</span>
                        )}

                        {ped.factura_id && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100/70 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 block">
                            <FileCheck2 className="w-3 h-3" /> Factura SRI Emitida
                          </span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {ped.estado === "pendiente" && (
                            <>
                              <button
                                onClick={() => handleConfirmarPago(ped.id)}
                                disabled={isProcessing}
                                title="Confirmar Pago y Mayorizar Contabilidad"
                                className="px-2.5 py-1.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white text-xs shadow-xs transition disabled:opacity-50 inline-flex items-center gap-1"
                              >
                                {isProcessing ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                                <span>Confirmar</span>
                              </button>

                              <button
                                onClick={() => {
                                  setCancelingId(ped.id);
                                  setMotivoCancelacion("");
                                }}
                                disabled={isProcessing}
                                title="Cancelar Pedido y Restituir Stock"
                                className="px-2 py-1.5 rounded-xl font-bold bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 hover:bg-red-200 text-xs transition"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => openDespachoModal(ped)}
                            className="px-2.5 py-1.5 rounded-xl font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-xs transition inline-flex items-center gap-1"
                            title="Despachar y Enviar Dirección al Repartidor o Courier"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Despacho</span>
                          </button>

                          <button
                            onClick={() => printShippingLabel(ped)}
                            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title="Imprimir Rótulo de Envío para el Paquete"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {ped.estado === "confirmado" && (
                            <button
                              onClick={() => handleCambiarEstado(ped.id, "enviado")}
                              disabled={isProcessing}
                              className="px-2.5 py-1.5 rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white text-xs shadow-xs transition inline-flex items-center gap-1"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>Despachar</span>
                            </button>
                          )}

                          {ped.estado === "enviado" && (
                            <button
                              onClick={() => handleCambiarEstado(ped.id, "entregado")}
                              disabled={isProcessing}
                              className="px-2.5 py-1.5 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white text-xs shadow-xs transition inline-flex items-center gap-1"
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                              <span>Entregado</span>
                            </button>
                          )}

                          <button
                            onClick={() => openDetalle(ped.id)}
                            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title="Ver Detalle Completo"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Barra de Paginación (Máximo 10 pedidos por página) */}
          {paginacion.total > 0 && (
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-slate-50/50 dark:bg-slate-900/50">
              <div className="text-slate-500 dark:text-slate-400">
                Mostrando{" "}
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {Math.min((paginaActual - 1) * 10 + 1, paginacion.total)}
                </span>{" "}
                a{" "}
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {Math.min(paginaActual * 10, paginacion.total)}
                </span>{" "}
                de{" "}
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {paginacion.total}
                </span>{" "}
                pedidos (10 por página)
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fetchPedidos(paginaActual - 1)}
                  disabled={paginaActual <= 1 || loading}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs"
                  title="Página Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Botones de número de página */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: paginacion.total_pages }, (_, i) => i + 1)
                    .filter((p) => {
                      return (
                        p === 1 ||
                        p === paginacion.total_pages ||
                        Math.abs(p - paginaActual) <= 1
                      );
                    })
                    .map((p, idx, arr) => {
                      const prev = arr[idx - 1];
                      return (
                        <div key={p} className="flex items-center">
                          {prev && p - prev > 1 && (
                            <span className="px-1 text-slate-400 font-bold">...</span>
                          )}
                          <button
                            type="button"
                            onClick={() => fetchPedidos(p)}
                            disabled={loading || paginaActual === p}
                            className={`min-w-8 h-8 px-2 rounded-xl font-bold text-xs transition ${
                              paginaActual === p
                                ? "bg-indigo-600 text-white shadow-xs"
                                : "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {p}
                          </button>
                        </div>
                      );
                    })}
                </div>

                <button
                  type="button"
                  onClick={() => fetchPedidos(paginaActual + 1)}
                  disabled={paginaActual >= paginacion.total_pages || loading}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs"
                  title="Página Siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
        )}
      </div>

      {/* 5. MODAL DETALLE DE PEDIDO */}
      {detallePedido && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="max-w-2xl w-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 my-8 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                  {detallePedido.numero_pedido}
                </span>
                <h3 className="font-black text-lg text-slate-900 dark:text-white">
                  Detalle del Pedido Web
                </h3>
              </div>
              <button
                onClick={() => setDetallePedido(null)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Info Cliente & Envío */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 text-xs">
              <div className="space-y-1">
                <span className="text-slate-400 font-bold uppercase tracking-wider block text-[10px]">Cliente & Contacto</span>
                <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{detallePedido.cliente_nombre}</p>
                <p className="text-slate-500">Cédula / RUC: {detallePedido.cliente_documento}</p>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span className="text-slate-500">Teléfono:</span>
                  <a
                    href={`https://wa.me/${detallePedido.cliente_telefono.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <Phone className="w-3 h-3" /> {detallePedido.cliente_telefono}
                  </a>
                </div>
                <p className="text-slate-500">Email: {detallePedido.cliente_email || "Sin email"}</p>
              </div>

              <div className="space-y-1.5">
                <span className="text-slate-400 font-bold uppercase tracking-wider block text-[10px]">Dirección de Entrega</span>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80">
                  <p className="text-slate-900 dark:text-slate-100 font-bold text-xs flex items-start gap-1.5">
                    <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>{detallePedido.cliente_direccion || "Sin dirección registrada"}</span>
                  </p>
                  <p className="text-slate-500 text-[11px] mt-1 font-semibold ml-5">
                    Ciudad / Cantón: <span className="text-slate-800 dark:text-slate-200 font-bold">{detallePedido.cliente_ciudad}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  {detallePedido.ubicacion_gps ? (
                    <a
                      href={detallePedido.ubicacion_gps}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/60 hover:bg-emerald-200 transition"
                    >
                      <Navigation className="w-3 h-3 text-emerald-600" /> Abrir GPS Exacto
                    </a>
                  ) : detallePedido.cliente_direccion ? (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        `${detallePedido.cliente_direccion}, ${detallePedido.cliente_ciudad}, Ecuador`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 transition"
                    >
                      <Navigation className="w-3 h-3" /> Ver en Google Maps
                    </a>
                  ) : null}

                  <button
                    onClick={() => openDespachoModal(detallePedido)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 transition"
                  >
                    <Send className="w-3 h-3" /> Configurar Despacho
                  </button>
                </div>

                {detallePedido.tipo_despacho === "motorizado" && detallePedido.motorizado_nombre ? (
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <Bike className="w-3.5 h-3.5" />
                    <span>
                      <strong>Motorizado Asignado:</strong> {detallePedido.motorizado_nombre}
                      {detallePedido.motorizado_telefono && <span> • Tel: {detallePedido.motorizado_telefono}</span>}
                    </span>
                  </div>
                ) : detallePedido.courier_nombre ? (
                  <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 text-[11px] text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5" />
                    <span>
                      <strong>Courier Asignado:</strong> {detallePedido.courier_nombre}
                      {detallePedido.courier_telefono && <span> • <strong>Tel:</strong> {detallePedido.courier_telefono}</span>}
                      {detallePedido.guia_envio && <span> • <strong>Guía:</strong> {detallePedido.guia_envio}</span>}
                    </span>
                  </div>
                ) : null}

                {detallePedido.notas && (
                  <p className="text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-xl text-[11px]">
                    <strong>Indicaciones de Entrega:</strong> {detallePedido.notas}
                  </p>
                )}
              </div>
            </div>

            {/* Ítems comprados */}
            <div>
              <h5 className="font-black text-xs uppercase tracking-wider text-slate-400 mb-2">Productos Comprados</h5>
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {detallePedido.detalles?.map((item: any) => (
                  <div key={item.id} className="p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-400 overflow-hidden shrink-0">
                        {item.imagen_url ? (
                          <img src={getAssetUrl(item.imagen_url)!} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <ShoppingBag className="w-4 h-4 opacity-50" />
                        )}
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">{item.nombre_producto}</span>
                        <span className="text-[11px] text-slate-400">
                          {Number(item.cantidad)} unidades × ${Number(item.precio_unitario).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <span className="font-black text-sm text-slate-900 dark:text-white">
                      ${Number(item.subtotal).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totales y Auditoría */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Auditoría Contable NIIF</span>
                <p className="text-slate-600 dark:text-slate-300">
                  Asiento Contable: <strong className="text-indigo-600 font-mono">#{detallePedido.numero_asiento || detallePedido.asiento_id || "-"}</strong> ({detallePedido.asiento_estado || "Pendiente"})
                </p>
                {detallePedido.comprobante_sri && (
                  <p className="text-slate-600 dark:text-slate-300">
                    Factura SRI: <strong className="text-emerald-600 font-mono">{detallePedido.comprobante_sri.numero_comprobante}</strong> ({detallePedido.comprobante_sri.estado})
                  </p>
                )}
              </div>

              <div className="text-right w-full sm:w-auto space-y-1">
                <div className="text-slate-500 flex justify-between sm:justify-end gap-4">
                  <span>Subtotal:</span>
                  <span>${Number(detallePedido.subtotal).toFixed(2)}</span>
                </div>
                {Number(detallePedido.impuesto) > 0 && (
                  <div className="text-slate-500 flex justify-between sm:justify-end gap-4">
                    <span>IVA (15%):</span>
                    <span>${Number(detallePedido.impuesto).toFixed(2)}</span>
                  </div>
                )}
                <div className="text-slate-500 flex justify-between sm:justify-end gap-4">
                  <span>Costo Envío:</span>
                  <span>${Number(detallePedido.costo_envio).toFixed(2)}</span>
                </div>
                <div className="pt-1 border-t border-slate-200 dark:border-slate-700 flex justify-between sm:justify-end gap-4 text-sm font-black text-indigo-600 dark:text-indigo-400">
                  <span>Total Pedido:</span>
                  <span className="text-base">${Number(detallePedido.total).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Acciones en Modal */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 flex-wrap">
                {detallePedido.comprobante_pago_url && (
                  <button
                    onClick={() => setComprobanteModalUrl(getAssetUrl(detallePedido.comprobante_pago_url)!)}
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" /> Ver Comprobante
                  </button>
                )}

                <button
                  onClick={() => printShippingLabel(detallePedido)}
                  className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
                  title="Imprimir Rótulo de Envío para el Paquete"
                >
                  <Printer className="w-3.5 h-3.5" /> Rótulo Envío
                </button>

                <button
                  onClick={() => openDespachoModal(detallePedido)}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm"
                >
                  <Truck className="w-3.5 h-3.5" /> Despachar / Enviar a Repartidor
                </button>
              </div>

              <div className="flex items-center gap-2 justify-end">
                {detallePedido.estado === "pendiente" && (
                  <button
                    onClick={() => handleConfirmarPago(detallePedido.id)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" /> Confirmar Pago y Mayorizar
                  </button>
                )}
                <button
                  onClick={() => setDetallePedido(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL VISOR DE COMPROBANTE BANCARIO */}
      {comprobanteModalUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="max-w-xl w-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-4 overflow-hidden space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
                Comprobante de Transferencia Bancaria
              </span>
              <button
                onClick={() => setComprobanteModalUrl(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-slate-100 dark:bg-slate-950 rounded-2xl p-2">
              {comprobanteModalUrl.endsWith(".pdf") ? (
                <iframe src={comprobanteModalUrl} className="w-full h-96 rounded-xl" />
              ) : (
                <img
                  src={comprobanteModalUrl}
                  alt="Comprobante"
                  className="max-h-[65vh] w-auto object-contain rounded-xl"
                />
              )}
            </div>

            <div className="flex justify-between items-center pt-2">
              <a
                href={comprobanteModalUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-bold"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Abrir original en pestaña nueva
              </a>
              <button
                onClick={() => setComprobanteModalUrl(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL CONFIGURACIÓN DE LA TIENDA B2C */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="max-w-xl w-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 my-8 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-md">
                  Ajustes B2C
                </span>
                <h3 className="font-black text-lg text-slate-900 dark:text-white mt-1">
                  Configurar Mi Tienda Online
                </h3>
              </div>
              <button
                onClick={() => setIsConfigOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Enlace público copiable */}
            {configTienda?.slug && (
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-between gap-3 text-xs">
                <div className="truncate">
                  <span className="text-[10px] uppercase font-bold text-indigo-500 block">Enlace de tu Tienda:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white truncate">
                    {typeof window !== "undefined" ? window.location.origin : ""}/{configTienda.slug}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={copyStoreLink}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shrink-0 flex items-center gap-1 transition"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? "Copiado" : "Copiar"}</span>
                </button>
              </div>
            )}

            <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
              {/* Switch Tienda Activa */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block text-sm">Estado de la Tienda Online</span>
                  <span className="text-[11px] text-slate-500">
                    {configForm.tienda_online_activa ? "La tienda está abierta al público" : "La tienda está en pausa / mantenimiento"}
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={configForm.tienda_online_activa === 1}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, tienda_online_activa: e.target.checked ? 1 : 0 })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Teléfono & WhatsApp de Pedidos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    WhatsApp para Recibir Pedidos <span className="text-emerald-600 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: 593991234567 o 0991234567"
                    value={configForm.whatsapp_contacto}
                    onChange={(e) => setConfigForm({ ...configForm, whatsapp_contacto: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/20 dark:bg-emerald-950/20 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Aquí los compradores enviarán la orden con 1 clic al finalizar.
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Teléfono Local / Soporte
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: 022345678 o 0991234567"
                    value={configForm.telefono}
                    onChange={(e) => setConfigForm({ ...configForm, telefono: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Visible en la barra superior de la tienda.
                  </span>
                </div>
              </div>

              {/* Configuración de Envíos y Ciudad */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                  Reglas de Despacho y Envío
                </span>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Ciudad Base de la Tienda *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Ibarra, Quito, Guayaquil, etc."
                    value={configForm.ciudad}
                    onChange={(e) => setConfigForm({ ...configForm, ciudad: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Se utiliza para determinar automáticamente si un pedido es de entrega local o fuera de la ciudad.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Costo Envío Local ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={configForm.costo_envio_local}
                      onChange={(e) => setConfigForm({ ...configForm, costo_envio_local: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Para entregas dentro de tu misma ciudad</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Costo Fuera de Ciudad / Nacional ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={configForm.costo_envio_nacional}
                      onChange={(e) => setConfigForm({ ...configForm, costo_envio_nacional: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Para envíos por Courier a otras provincias</span>
                  </div>
                </div>
              </div>

              {/* Datos Bancarios para transferencias */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Cuentas Bancarias (para pagos por transferencia)
                </label>
                <textarea
                  rows={3}
                  placeholder="Banco Pichincha - Cta Corriente # 123456789 - RUC: 1712345678001 - A nombre de: Mi Negocio"
                  value={configForm.datos_bancarios}
                  onChange={(e) => setConfigForm({ ...configForm, datos_bancarios: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                />
              </div>

              {/* Descripción */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Descripción / Slogan de la Tienda
                </label>
                <textarea
                  rows={2}
                  placeholder="Los mejores productos tecnológicos y accesorios con garantía en todo el Ecuador."
                  value={configForm.descripcion}
                  onChange={(e) => setConfigForm({ ...configForm, descripcion: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsConfigOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-600/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {savingConfig && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. MODAL CANCELACIÓN DE PEDIDO */}
      {cancelingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-950 flex items-center justify-center">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">Cancelar Pedido Web</h3>
                <p className="text-xs text-slate-500">Se restituirá el inventario y se anulará la contabilidad.</p>
              </div>
            </div>

            <form onSubmit={handleCancelarSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Motivo de la cancelación *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Comprobante de pago inválido, cliente desistió de la compra, etc."
                  value={motivoCancelacion}
                  onChange={(e) => setMotivoCancelacion(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCancelingId(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 font-bold"
                >
                  Regresar
                </button>
                <button
                  type="submit"
                  disabled={processingCancel}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-md shadow-red-600/20 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {processingCancel && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirmar Cancelación</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. MODAL DE DESPACHO Y ENVÍO A REPARTIDOR / COURIER */}
      {despachoPedido && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
          <div className="max-w-xl w-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 my-8 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    Despacho & Envío del Pedido
                  </h3>
                  <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    #{despachoPedido.numero_pedido}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setDespachoPedido(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Recuadro de Dirección y Destinatario */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  📍 Datos de Entrega al Cliente
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                  despachoPedido.metodo_pago === "contra_entrega"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                }`}>
                  {despachoPedido.metodo_pago === "contra_entrega" ? "Cobrar Contra Entrega" : "Pago Confirmado"}
                </span>
              </div>

              <div className="space-y-1.5">
                <p className="font-bold text-sm text-slate-900 dark:text-white">
                  {despachoPedido.cliente_nombre}
                </p>
                <p className="text-slate-600 dark:text-slate-300 font-medium">
                  <strong>Teléfono Cliente:</strong> {despachoPedido.cliente_telefono}
                </p>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80">
                  <span className="font-semibold text-slate-900 dark:text-slate-100 block text-xs">
                    {despachoPedido.cliente_direccion || "Sin dirección registrada"}
                  </span>
                  <span className="text-slate-500 text-[11px] font-bold block mt-0.5">
                    Ciudad / Cantón: {despachoPedido.cliente_ciudad}
                  </span>
                  {despachoPedido.notas && (
                    <span className="text-amber-700 dark:text-amber-400 text-[11px] block mt-1 pt-1 border-t border-slate-100 dark:border-slate-800 italic">
                      Nota: {despachoPedido.notas}
                    </span>
                  )}
                </div>

                {despachoPedido.ubicacion_gps && (
                  <div className="flex items-center justify-between text-[11px] text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800">
                    <span className="flex items-center gap-1 font-semibold">
                      <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" /> Coordenadas GPS del cliente disponibles
                    </span>
                    <a
                      href={despachoPedido.ubicacion_gps}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold underline text-[11px] hover:text-indigo-900"
                    >
                      Abrir en Google Maps
                    </a>
                  </div>
                )}

                <div className="pt-1 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Monto total de la orden:</span>
                  <span className="font-black text-sm text-slate-900 dark:text-white">
                    ${Number(despachoPedido.total).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* SELECTOR: MOTORIZADO O EMPRESA */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Selecciona la modalidad de entrega:
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setTipoDespacho("motorizado")}
                  className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition ${
                    tipoDespacho === "motorizado"
                      ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Bike className="w-4 h-4" />
                  <span>1. Motorizado / Repartidor</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTipoDespacho("empresa")}
                  className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition ${
                    tipoDespacho === "empresa"
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Truck className="w-4 h-4" />
                  <span>2. Empresa / Courier</span>
                </button>
              </div>
            </div>

            {/* VISTA 1: MOTORIZADO / REPARTIDOR LOCAL */}
            {tipoDespacho === "motorizado" && (
              <div className="space-y-3 p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                    <Bike className="w-4 h-4" /> Despacho con Motorizado o Repartidor Local
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyDeliveryInfo}
                    className="text-[11px] text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 font-bold"
                  >
                    {copiedDelivery ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedDelivery ? "¡Copiado!" : "Copiar Datos"}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Nombre del Repartidor
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Carlos Mendoza (Motorizado)"
                      value={motorizadoNombre}
                      onChange={(e) => setMotorizadoNombre(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      WhatsApp del Repartidor *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 0991234567"
                      value={motorizadoTelefono}
                      onChange={(e) => setMotorizadoTelefono(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSendToDriverWhatsApp}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar Dirección y Ruta GPS por WhatsApp al Motorizado</span>
                </button>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                  El motorizado recibirá por WhatsApp el nombre y teléfono del cliente, dirección exacta, monto a cobrar (si contra entrega) y el enlace con navegación GPS en Google Maps.
                </p>
              </div>
            )}

            {/* VISTA 2: EMPRESA DE ENVIOS / COURIER */}
            {tipoDespacho === "empresa" && (
              <div className="space-y-3 p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/50 text-xs">
                <span className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                  <Truck className="w-4 h-4" /> Despacho con Empresa de Envíos / Courier
                </span>

                {/* Accesos rápidos a empresas */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Selecciona una empresa frecuente o escribe el nombre:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {["Servientrega", "Tramaco Express", "Laarcourier", "Cooperativa / Terminal", "Urbano"].map((courier) => (
                      <button
                        key={courier}
                        type="button"
                        onClick={() => setCourierNombre(courier)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                          courierNombre === courier
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                            : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400"
                        }`}
                      >
                        {courier}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Nombre de la Empresa *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Servientrega"
                      value={courierNombre}
                      onChange={(e) => setCourierNombre(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      WhatsApp / Tel. de la Empresa
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 0991234567"
                      value={courierTelefono}
                      onChange={(e) => setCourierTelefono(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      N° de Guía / Rastreo (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: GUIA-9874521"
                      value={guiaEnvio}
                      onChange={(e) => setGuiaEnvio(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Acciones de envío a la empresa */}
                <div className="pt-1 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleSendToCourierWhatsApp}
                      className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Enviar Datos del Envío a la Empresa (WhatsApp)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyCourierInfo}
                      className="w-full py-2.5 px-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                    >
                      {copiedCourierInfo ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCourierInfo ? "¡Datos Copiados!" : "Copiar Datos para la Empresa"}</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-indigo-700 dark:text-indigo-400">
                    Envía a la agencia o courier la información completa del destinatario (nombre, cédula, teléfono, ciudad, dirección exacta, monto a cobrar si es contra entrega y enlace GPS).
                  </p>
                </div>

                {/* Notificación de guía al cliente */}
                <div className="pt-2 border-t border-indigo-200/60 dark:border-indigo-800/40 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Notificación al Cliente:
                  </span>
                  <button
                    type="button"
                    onClick={handleSendTrackingToCustomer}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar Guía de Rastreo al Cliente por WhatsApp</span>
                  </button>
                </div>
              </div>
            )}

            {/* Footer y Acciones */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => printShippingLabel(despachoPedido)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir Rótulo de Paquete</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={savingDespacho}
                  onClick={() => handleSaveDespacho(false)}
                  className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 font-bold text-xs"
                >
                  Guardar Datos
                </button>
                <button
                  type="button"
                  disabled={savingDespacho}
                  onClick={() => handleSaveDespacho(true)}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center justify-center gap-1.5"
                >
                  {savingDespacho && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Marcar como Enviado</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
