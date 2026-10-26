"use client";

import { use, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  ShoppingBag,
  ShoppingCart,
  Search,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Phone,
  MapPin,
  Truck,
  CreditCard,
  Building2,
  UploadCloud,
  FileText,
  X,
  Plus,
  Minus,
  Trash2,
  ExternalLink,
  Store,
  ArrowRight,
  ShieldCheck,
  Send,
  Loader2,
  Navigation,
  Check,
} from "lucide-react";

interface Producto {
  id: number;
  categoria_id: number | null;
  categoria_nombre: string;
  nombre: string;
  descripcion: string;
  codigo_barra: string;
  precio_venta: number;
  stock: number;
  imagen_url: string | null;
  tarifa_iva: number;
}

interface Categoria {
  id: number;
  nombre: string;
  total_productos: number;
}

interface TiendaInfo {
  id: number;
  nombre: string;
  slug: string;
  descripcion: string;
  logo_url: string | null;
  telefono: string | null;
  whatsapp_contacto: string | null;
  direccion: string | null;
  ciudad?: string | null;
  costo_envio_fijo: number;
  costo_envio_local?: number;
  costo_envio_nacional?: number;
  datos_bancarios: string | null;
}

interface CartItem {
  producto: Producto;
  cantidad: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost/pymeweb/backend-api/api";

function getAssetUrl(url?: string | null) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = API_BASE.replace(/\/api\/?$/, "");
  return `${base}/${url.replace(/^\//, "")}`;
}

function formatWhatsAppNumber(phone?: string | null): string | null {
  if (!phone) return null;
  let clean = phone.replace(/\D/g, "");
  if (!clean) return null;
  if (clean.startsWith("09") && clean.length === 10) {
    clean = "593" + clean.substring(1);
  }
  return clean;
}

export default function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  const [loading, setLoading] = useState(true);
  const [storeData, setStoreData] = useState<{
    activo: boolean;
    motivo?: string;
    mensaje?: string;
    tienda?: TiendaInfo;
    categorias?: Categoria[];
    productos?: Producto[];
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Formulario de Checkout
  const [cliente, setCliente] = useState({
    nombre: "",
    documento: "",
    email: "",
    telefono: "",
    direccion: "",
    ciudad: "",
    ubicacion_gps: "",
  });
  const [loadingGps, setLoadingGps] = useState(false);
  const [gpsSuccess, setGpsSuccess] = useState(false);
  const [metodoPago, setMetodoPago] = useState<"transferencia" | "contra_entrega">("transferencia");
  const [notas, setNotas] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  // Cargar ubicación GPS actual
  const handleGetLocation = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      alert("La geolocalización no es compatible con tu navegador.");
      return;
    }

    setLoadingGps(true);
    setGpsSuccess(false);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const mapsLink = `https://www.google.com/maps?q=${lat},${lng}`;

        let direccionDetectada = "";
        let ciudadDetectada = "";

        // Intento de geocodificación inversa con OpenStreetMap
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            { headers: { "Accept-Language": "es" } }
          );
          if (res.ok) {
            const data = await res.json();
            if (data.address) {
              const road = data.address.road || data.address.pedestrian || data.address.suburb || "";
              const houseNumber = data.address.house_number ? `#${data.address.house_number}` : "";
              const city = data.address.city || data.address.town || data.address.village || data.address.state_district || "";
              if (road) direccionDetectada = `${road} ${houseNumber}`.trim();
              if (city) ciudadDetectada = city;
            }
          }
        } catch (_) {
          // Si Nominatim falla o tarda, mantenemos las coordenadas
        }

        setCliente((prev) => ({
          ...prev,
          direccion: direccionDetectada || prev.direccion || `Ubicación GPS (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
          ciudad: ciudadDetectada || prev.ciudad || "Quito",
          ubicacion_gps: mapsLink,
        }));
        setGpsSuccess(true);
        setLoadingGps(false);
      },
      (err) => {
        setLoadingGps(false);
        let msg = "No se pudo obtener la ubicación.";
        if (err.code === 1) msg = "Permiso de ubicación denegado. Permite el acceso al GPS en tu navegador para cargar tu dirección.";
        else if (err.code === 2) msg = "Posición no disponible o sin señal GPS.";
        else if (err.code === 3) msg = "Tiempo de espera agotado al consultar GPS.";
        alert(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Resultado de orden realizada
  const [orderSuccess, setOrderSuccess] = useState<any>(null);
  const [uploadingVoucher, setUploadingVoucher] = useState(false);
  const [voucherUrl, setVoucherUrl] = useState<string | null>(null);
  const [voucherError, setVoucherError] = useState("");

  // Cargar catálogo de la tienda
  useEffect(() => {
    fetch(`${API_BASE}/public/storefront.php?slug=${encodeURIComponent(slug)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok && res.status !== 403 && res.status !== 404) {
          throw new Error(data.error || "Error al cargar la tienda");
        }
        setStoreData(data);
        if (data?.tienda) {
          const ciudadBase = data.tienda.ciudad || data.tienda.direccion || "Ibarra";
          setCliente((prev) => ({
            ...prev,
            ciudad: prev.ciudad || ciudadBase,
          }));
        }
      })
      .catch((err) => {
        setStoreData({
          activo: false,
          motivo: "error",
          mensaje: err.message || "No pudimos conectar con los servidores de la tienda.",
        });
      })
      .finally(() => setLoading(false));
  }, [slug]);

  // Manejo de Carrito
  const addToCart = (prod: Producto) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.producto.id === prod.id);
      if (idx >= 0) {
        const nuevaCant = prev[idx].cantidad + 1;
        if (nuevaCant > prod.stock) return prev;
        const copy = [...prev];
        copy[idx].cantidad = nuevaCant;
        return copy;
      }
      return [...prev, { producto: prod, cantidad: 1 }];
    });
    setIsCartOpen(true);
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.producto.id === id) {
            const nueva = item.cantidad + delta;
            if (nueva <= 0) return null;
            if (nueva > item.producto.stock) return item;
            return { ...item, cantidad: nueva };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (id: number) => {
    setCart((prev) => prev.filter((i) => i.producto.id !== id));
  };

  // Cálculos del Carrito
  const totales = useMemo(() => {
    let subtotal15 = 0;
    let subtotal0 = 0;
    let iva = 0;
    let totalItems = 0;

    for (const item of cart) {
      const linea = item.cantidad * item.producto.precio_venta;
      totalItems += item.cantidad;
      if (item.producto.tarifa_iva > 0) {
        subtotal15 += linea;
        iva += linea * (item.producto.tarifa_iva / 100);
      } else {
        subtotal0 += linea;
      }
    }

    const normalizeCity = (c?: string | null) => {
      if (!c) return "";
      return c
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "")
        .trim();
    };

    const ciudadTienda = storeData?.tienda?.ciudad || storeData?.tienda?.direccion || "Ibarra";
    const cTienda = normalizeCity(ciudadTienda);
    const cCliente = normalizeCity(cliente.ciudad);

    // Si cliente no ha ingresado ciudad o coincide con la tienda, aplica tarifa local; si es diferente, tarifa nacional/fuera de ciudad
    const esEnvioLocal = !cCliente || !cTienda || cTienda.includes(cCliente) || cCliente.includes(cTienda);

    const costoLocal = Number(storeData?.tienda?.costo_envio_local ?? 2.0);
    const costoNacional = Number(storeData?.tienda?.costo_envio_nacional ?? (storeData?.tienda?.costo_envio_fijo || 5.0));
    const envio = esEnvioLocal ? costoLocal : costoNacional;

    const subtotal = subtotal15 + subtotal0;
    const total = subtotal + iva + envio;

    return {
      subtotal15,
      subtotal0,
      subtotal,
      iva,
      envio,
      esEnvioLocal,
      nombreCiudadTienda: ciudadTienda,
      costoLocal,
      costoNacional,
      total,
      totalItems,
    };
  }, [cart, storeData, cliente.ciudad]);

  // Filtrado de productos
  const productosFiltrados = useMemo(() => {
    if (!storeData?.productos) return [];
    return storeData.productos.filter((p) => {
      const matchCat = selectedCatId === null || p.categoria_id === selectedCatId;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        q === "" ||
        p.nombre.toLowerCase().includes(q) ||
        p.descripcion.toLowerCase().includes(q) ||
        p.codigo_barra.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [storeData?.productos, selectedCatId, searchQuery]);

  // Procesar Checkout
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError("");

    if (!cliente.nombre || !cliente.documento || !cliente.telefono || !cliente.direccion) {
      setCheckoutError("Por favor completa los campos obligatorios para la entrega y facturación.");
      return;
    }

    if (cart.length === 0) {
      setCheckoutError("El carrito de compras está vacío.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/public/checkout.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          cliente,
          metodo_pago: metodoPago,
          items: cart.map((i) => ({
            producto_id: i.producto.id,
            cantidad: i.cantidad,
          })),
          notas,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo procesar tu orden.");
      }

      setOrderSuccess(data);
      setCart([]);
      setIsCheckoutOpen(false);
    } catch (err: any) {
      setCheckoutError(err.message || "Error al procesar el pedido.");
    } finally {
      setSubmitting(false);
    }
  };

  // Subir comprobante bancario
  const handleVoucherUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !orderSuccess) return;

    setUploadingVoucher(true);
    setVoucherError("");

    const formData = new FormData();
    formData.append("pedido_id", orderSuccess.pedido_id);
    formData.append("numero_pedido", orderSuccess.numero_pedido);
    formData.append("comprobante", file);

    try {
      const res = await fetch(`${API_BASE}/public/upload-comprobante.php`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al subir el comprobante.");
      }
      setVoucherUrl(data.comprobante_url);
    } catch (err: any) {
      setVoucherError(err.message || "No se pudo subir el archivo.");
    } finally {
      setUploadingVoucher(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
        <p className="text-sm font-semibold tracking-wide">Cargando catálogo de la tienda...</p>
      </div>
    );
  }

  // =========================================================================
  // MURO DE PAGO SAAS / ESTADO INACTIVO O NO ENCONTRADO
  // =========================================================================
  if (!storeData?.activo) {
    const isPaywall = storeData?.motivo === "muro_pago";
    const isSuspended = storeData?.motivo === "suspendido";
    const isNotFound = storeData?.motivo === "no_encontrado";

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
            {isPaywall ? <Lock className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
          </div>

          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
            {isPaywall
              ? "Catálogo Online Temporalmente Inactivo"
              : isSuspended
              ? "Tienda Suspendida"
              : isNotFound
              ? "Tienda No Encontrada"
              : "Tienda en Mantenimiento"}
          </h2>

          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            {storeData?.mensaje || "Esta tienda no puede recibir pedidos en este momento."}
          </p>

          {isPaywall && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-left mb-6">
              <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                💡 <strong>¿Eres el administrador de este negocio?</strong>
                <br />
                Tu periodo de suscripción en PymeWeb ERP ha vencido. Renueva o reactiva tu suscripción para desbloquear tu tienda online instantáneamente.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 transition text-sm"
            >
              <Store className="w-4 h-4" />
              <span>Acceder al ERP de PymeWeb</span>
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const tienda = storeData.tienda!;
  const rawWhatsApp = tienda.whatsapp_contacto || tienda.telefono;
  const whatsappNumber = formatWhatsAppNumber(rawWhatsApp);
  const whatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
        `Hola ${tienda.nombre}, tengo una consulta sobre sus productos en la tienda web.`
      )}`
    : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* 1. TOP BAR / BANNER */}
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-800 text-white text-xs py-2 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-3.5 h-3.5" />
            <span>
              {tienda.costo_envio_fijo > 0
                ? `Envíos a todo el país • Tarifa plana: $${tienda.costo_envio_fijo.toFixed(2)}`
                : "¡Envío gratis a todo el país!"}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {tienda.telefono && (
              <span className="hidden sm:inline-flex items-center gap-1 opacity-90">
                <Phone className="w-3 h-3" /> {tienda.telefono}
              </span>
            )}
            <div className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              <span>Compra 100% Segura</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. NAVBAR */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {tienda.logo_url ? (
              <img
                src={getAssetUrl(tienda.logo_url)!}
                alt={tienda.nombre}
                className="w-11 h-11 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
              />
            ) : (
              <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-indigo-600/30">
                {tienda.nombre.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="font-extrabold text-base md:text-lg leading-tight tracking-tight">{tienda.nombre}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" />
                {tienda.direccion || "Ecuador"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />

            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-600/20 transition active:scale-95"
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden sm:inline">Carrito</span>
              {totales.totalItems > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-400 text-slate-900 text-xs font-black">
                  {totales.totalItems}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* 3. HERO / STORE HEADER */}
      <section className="bg-gradient-to-b from-indigo-50/60 to-white dark:from-slate-900/40 dark:to-slate-950 border-b border-slate-200 dark:border-slate-800/80 py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-100/70 dark:bg-indigo-950/60 px-3 py-1 rounded-full mb-3">
              <ShoppingBag className="w-3.5 h-3.5" /> Catálogo Oficial B2C
            </span>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Explora nuestros productos y pide online
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {tienda.descripcion}
            </p>
          </div>

          {/* Buscador */}
          <div className="w-full md:w-80 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar productos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Categorías Pills */}
        {storeData.categorias && storeData.categorias.length > 0 && (
          <div className="max-w-7xl mx-auto mt-6 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => setSelectedCatId(null)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                selectedCatId === null
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300"
              }`}
            >
              Todos ({storeData.productos?.length || 0})
            </button>
            {storeData.categorias.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCatId(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  selectedCatId === cat.id
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                }`}
              >
                {cat.nombre} ({cat.total_productos})
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 4. PRODUCT GRID */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">
        {productosFiltrados.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-400">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold">No se encontraron productos</h3>
            <p className="text-xs text-slate-500 mt-1">Prueba con otra palabra clave o selecciona otra categoría.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {productosFiltrados.map((prod) => {
              const inCartItem = cart.find((i) => i.producto.id === prod.id);
              const cantEnCarrito = inCartItem?.cantidad ?? 0;
              const sinStock = prod.stock <= 0;

              return (
                <div
                  key={prod.id}
                  className="group flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-xl hover:border-indigo-500/40 transition duration-200"
                >
                  {/* Imagen */}
                  <div className="relative aspect-square bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    {prod.imagen_url ? (
                      <img
                        src={getAssetUrl(prod.imagen_url)!}
                        alt={prod.nombre}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                        <ShoppingBag className="w-10 h-10 opacity-40 mb-1" />
                        <span className="text-[10px] uppercase font-bold tracking-wider">Sin foto</span>
                      </div>
                    )}

                    {/* Badges superiores */}
                    <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-1 pointer-events-none">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/90 dark:bg-slate-900/90 text-slate-800 dark:text-slate-200 backdrop-blur-sm shadow-sm border border-slate-200/50">
                        {prod.categoria_nombre}
                      </span>
                      {prod.tarifa_iva > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-600 text-white shadow-sm">
                          IVA {prod.tarifa_iva}%
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white shadow-sm">
                          IVA 0%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug group-hover:text-indigo-600 transition">
                        {prod.nombre}
                      </h4>
                      {prod.descripcion && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                          {prod.descripcion}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-end justify-between gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Precio</span>
                        <span className="text-lg font-black text-slate-900 dark:text-white">
                          ${prod.precio_venta.toFixed(2)}
                        </span>
                      </div>

                      {cantEnCarrito > 0 ? (
                        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                          <button
                            onClick={() => updateQuantity(prod.id, -1)}
                            className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold transition"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-black px-1.5">{cantEnCarrito}</span>
                          <button
                            onClick={() => updateQuantity(prod.id, 1)}
                            disabled={cantEnCarrito >= prod.stock}
                            className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 font-bold transition disabled:opacity-40"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(prod)}
                          disabled={sinStock}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 active:scale-95"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>{sinStock ? "Agotado" : "Agregar"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 5. CART DRAWER (SLIDE-OVER) */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsCartOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white dark:bg-slate-900 shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800">
              {/* Header Carrito */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-extrabold text-base">Tu Carrito ({totales.totalItems})</h3>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Items */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                    <ShoppingCart className="w-12 h-12 stroke-1 opacity-30 mb-3" />
                    <p className="font-bold text-sm text-slate-700 dark:text-slate-300">Tu carrito está vacío</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Agrega productos desde el catálogo para iniciar tu compra.
                    </p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={item.producto.id}
                      className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800"
                    >
                      <div className="w-14 h-14 rounded-xl bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0">
                        {item.producto.imagen_url ? (
                          <img
                            src={getAssetUrl(item.producto.imagen_url)!}
                            alt={item.producto.nombre}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <ShoppingBag className="w-5 h-5 opacity-40" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h5 className="font-bold text-xs truncate leading-tight text-slate-900 dark:text-white">
                          {item.producto.nombre}
                        </h5>
                        <p className="text-xs text-slate-500 mt-0.5">
                          ${item.producto.precio_venta.toFixed(2)} c/u
                        </p>

                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => updateQuantity(item.producto.id, -1)}
                            className="w-6 h-6 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-xs font-bold"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-black min-w-5 text-center">{item.cantidad}</span>
                          <button
                            onClick={() => updateQuantity(item.producto.id, 1)}
                            disabled={item.cantidad >= item.producto.stock}
                            className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-bold disabled:opacity-40"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="text-right flex flex-col justify-between items-end h-14">
                        <button
                          onClick={() => removeFromCart(item.producto.id)}
                          className="text-slate-400 hover:text-red-500 p-0.5 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <span className="font-black text-sm text-slate-900 dark:text-white">
                          ${(item.cantidad * item.producto.precio_venta).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer Resumen y Botón Pagar */}
              {cart.length > 0 && (
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-2">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Subtotal</span>
                    <span>${totales.subtotal.toFixed(2)}</span>
                  </div>
                  {totales.iva > 0 && (
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>IVA (15%)</span>
                      <span>${totales.iva.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span>Costo de Envío</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        totales.esEnvioLocal
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400"
                      }`}>
                        {totales.esEnvioLocal ? `Local (${totales.nombreCiudadTienda})` : `Fuera de ${totales.nombreCiudadTienda}`}
                      </span>
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {totales.envio > 0 ? `$${totales.envio.toFixed(2)}` : "Gratis"}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-base font-black text-slate-900 dark:text-white">
                    <span>Total a Pagar</span>
                    <span className="text-xl text-indigo-600 dark:text-indigo-400">
                      ${totales.total.toFixed(2)}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setIsCartOpen(false);
                      setIsCheckoutOpen(true);
                    }}
                    className="w-full mt-3 py-3 px-4 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 transition active:scale-95 flex items-center justify-center gap-2 text-sm"
                  >
                    <span>Completar Pedido</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. HYBRID CHECKOUT MODAL */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="max-w-2xl w-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-black text-lg text-slate-900 dark:text-white">Finalizar Compra</h3>
                <p className="text-xs text-slate-500">Completa tus datos para el envío y tu factura electrónica SRI legal</p>
              </div>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCheckoutSubmit} className="p-6 space-y-6">
              {checkoutError && (
                <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-medium">
                  {checkoutError}
                </div>
              )}

              {/* Datos de Entrega y Facturación */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">1. Datos Personales y Entrega</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Nombre y Apellido *
                    </label>
                    <input
                      type="text"
                      required
                      value={cliente.nombre}
                      onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })}
                      placeholder="Juan Pérez"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Cédula o RUC (Facturación) *
                    </label>
                    <input
                      type="text"
                      required
                      value={cliente.documento}
                      onChange={(e) => setCliente({ ...cliente, documento: e.target.value })}
                      placeholder="1712345678 o 1712345678001"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Teléfono / WhatsApp *
                    </label>
                    <input
                      type="tel"
                      required
                      value={cliente.telefono}
                      onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })}
                      placeholder="0991234567"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Correo Electrónico (para RIDE y XML SRI)
                    </label>
                    <input
                      type="email"
                      value={cliente.email}
                      onChange={(e) => setCliente({ ...cliente, email: e.target.value })}
                      placeholder="cliente@correo.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        Dirección Exacta de Entrega *
                      </label>
                      <button
                        type="button"
                        onClick={handleGetLocation}
                        disabled={loadingGps}
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 transition active:scale-95 disabled:opacity-50"
                      >
                        {loadingGps ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                            <span>Detectando GPS...</span>
                          </>
                        ) : gpsSuccess ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-700 dark:text-emerald-400">GPS cargado</span>
                          </>
                        ) : (
                          <>
                            <Navigation className="w-3 h-3" />
                            <span>📍 Cargar mi ubicación</span>
                          </>
                        )}
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      value={cliente.direccion}
                      onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })}
                      placeholder="Calle Principal #123 y Secundaria"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    {cliente.ubicacion_gps && (
                      <div className="flex items-center justify-between text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 mt-1.5">
                        <span className="flex items-center gap-1 font-medium truncate">
                          <MapPin className="w-3 h-3 shrink-0 text-emerald-600" /> Coordenadas GPS listas para el repartidor
                        </span>
                        <a
                          href={cliente.ubicacion_gps}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold underline shrink-0 ml-2 hover:text-emerald-800"
                        >
                          Ver en mapa
                        </a>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        Ciudad de Destino *
                      </label>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        totales.esEnvioLocal
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400"
                      }`}>
                        {totales.esEnvioLocal ? `Envío Local (${totales.nombreCiudadTienda})` : `Envío Fuera de ${totales.nombreCiudadTienda}`}
                      </span>
                    </div>
                    <input
                      type="text"
                      required
                      value={cliente.ciudad}
                      onChange={(e) => setCliente({ ...cliente, ciudad: e.target.value })}
                      placeholder={`Ej: ${totales.nombreCiudadTienda}, Quito, Guayaquil...`}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {totales.esEnvioLocal 
                        ? `🚚 Tarifa local (${totales.nombreCiudadTienda}): $${totales.costoLocal.toFixed(2)}`
                        : `📦 Tarifa fuera de ciudad / nacional: $${totales.costoNacional.toFixed(2)}`}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Instrucciones o Referencias de Entrega
                  </label>
                  <input
                    type="text"
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Casa de dos pisos blanca, dejar con el guardia, etc."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Método de Pago */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">2. Método de Pago</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMetodoPago("transferencia")}
                    className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition ${
                      metodoPago === "transferencia"
                        ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 shadow-sm"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <Building2 className="w-5 h-5 mb-2 text-indigo-600" />
                    <div>
                      <span className="font-bold text-xs block">Transferencia Bancaria</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">Pichincha, Guayaquil, etc.</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMetodoPago("contra_entrega")}
                    className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition ${
                      metodoPago === "contra_entrega"
                        ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 shadow-sm"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <Truck className="w-5 h-5 mb-2 text-indigo-600" />
                    <div>
                      <span className="font-bold text-xs block">Contra Entrega</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">Paga al recibir paquete</span>
                    </div>
                  </button>
                </div>

                {metodoPago === "transferencia" && (
                  <div className="p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200 space-y-1">
                    <p className="font-bold">Datos Bancarios para la Transferencia:</p>
                    <p className="whitespace-pre-line text-xs font-mono">{tienda.datos_bancarios}</p>
                    <p className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-2">
                      💡 Al confirmar tu pedido, podrás subir la captura del comprobante inmediatamente en pantalla.
                    </p>
                  </div>
                )}
              </div>

              {/* Botón Submit */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>Envío:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      ${totales.envio.toFixed(2)}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                      totales.esEnvioLocal
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400"
                    }`}>
                      {totales.esEnvioLocal ? `Local (${totales.nombreCiudadTienda})` : `Fuera de ${totales.nombreCiudadTienda}`}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-slate-500">Total:</span>
                    <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                      ${totales.total.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCheckoutOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Procesando...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirmar y Reservar Stock</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. ORDER SUCCESS & RECEIPT UPLOAD MODAL */}
      {orderSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-center my-8">
            <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-black text-slate-900 dark:text-white">¡Pedido Registrado con Éxito!</h3>
            <p className="text-xs text-slate-500 mt-1">El stock de tus productos ha sido reservado automáticamente.</p>

            <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-left space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Número de Pedido:</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {orderSuccess.numero_pedido}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total a Pagar:</span>
                <span className="font-black text-sm text-slate-900 dark:text-white">
                  ${orderSuccess.total.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Método de Pago:</span>
                <span className="font-bold capitalize">{orderSuccess.metodo_pago}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700/60">
                <span className="text-slate-500">Dirección de Envío:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-right max-w-[220px]">
                  {cliente.direccion}, {cliente.ciudad}
                </span>
              </div>
              {cliente.ubicacion_gps && (
                <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700/60 items-center">
                  <span className="text-slate-500">Ubicación GPS:</span>
                  <a
                    href={cliente.ubicacion_gps}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 text-[11px]"
                  >
                    <span>Ver en Google Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            {/* Subir Comprobante si fue transferencia */}
            {orderSuccess.metodo_pago === "transferencia" && (
              <div className="mt-5 text-left space-y-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Adjuntar Comprobante de Transferencia:
                </span>

                {voucherUrl ? (
                  <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>¡Comprobante adjuntado con éxito! El dueño revisará tu pago.</span>
                  </div>
                ) : (
                  <div>
                    <label className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 cursor-pointer transition bg-slate-50 dark:bg-slate-900">
                      <UploadCloud className="w-6 h-6 text-indigo-600 mb-1" />
                      <span className="text-xs font-bold text-indigo-600">
                        {uploadingVoucher ? "Subiendo archivo..." : "Seleccionar foto o PDF"}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">JPG, PNG o PDF (Máx 5MB)</span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleVoucherUpload}
                        disabled={uploadingVoucher}
                        className="hidden"
                      />
                    </label>
                    {voucherError && <p className="text-[11px] text-red-500 mt-1">{voucherError}</p>}
                  </div>
                )}
              </div>
            )}

            {/* Acciones Finales */}
            <div className="mt-6 flex flex-col gap-2">
              {whatsappNumber && (
                <a
                  href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                    `Hola ${tienda.nombre}, acabo de realizar el pedido ${orderSuccess.numero_pedido} por un valor de $${orderSuccess.total.toFixed(2)}. Mi nombre es ${cliente.nombre}.\n📍 Dirección de entrega: ${cliente.direccion}, ${cliente.ciudad}.${cliente.ubicacion_gps ? `\n🗺️ Ubicación GPS: ${cliente.ubicacion_gps}` : ''}\n💳 Forma de pago: ${orderSuccess.metodo_pago}.`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition"
                >
                  <Send className="w-4 h-4" />
                  <span>Notificar Pedido por WhatsApp</span>
                </a>
              )}

              <button
                onClick={() => setOrderSuccess(null)}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-700 dark:text-slate-300"
              >
                Cerrar y Continuar en la Tienda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. FOOTER */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 py-8 px-4 text-center">
        <div className="max-w-7xl mx-auto space-y-3">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {tienda.nombre} • Tienda Online Oficial
          </p>
          <p className="text-xs text-slate-400">
            Desarrollado y respaldado por{" "}
            <Link href="/" className="font-bold text-indigo-600 hover:underline">
              PymeWeb ERP Ecuador
            </Link>{" "}
            • Facturación Electrónica SRI & Contabilidad NIIF
          </p>
        </div>
      </footer>
    </div>
  );
}
