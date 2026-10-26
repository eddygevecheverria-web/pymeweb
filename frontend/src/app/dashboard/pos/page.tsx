"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import CameraBarcodeScanner from "@/components/CameraBarcodeScanner";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  ShoppingBag,
  UserCheck,
  UserPlus,
  FileText,
  Mail,
  Download,
  Clock,
  Banknote,
  Send,
  Camera,
  X,
  AlertCircle,
  Calendar,
  Eye,
  Receipt,
  RefreshCw,
  Printer,
} from "lucide-react";
import InvoicePrintModal, { getPrinterConfig, PrinterConfig, DEFAULT_PRINTER_CONFIG } from "@/components/InvoicePrintModal";


interface Product {
  id: number;
  categoria_id?: number | null;
  categoria_nombre?: string | null;
  codigo_barra: string | null;
  nombre: string;
  precio_venta: number;
  stock: number;
  imagen_url: string | null;
}

interface CartItem extends Product {
  cantidad: number;
}

interface Customer {
  id: number;
  documento: string | null;
  nombre: string;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  saldo_pendiente: number | string;
}

interface PurchaseItem {
  producto_id: number;
  nombre_producto: string;
  cantidad: number;
  precio_unitario: number | string;
  subtotal: number | string;
}

interface Purchase {
  venta_id: number;
  fecha: string;
  metodo_pago: string;
  subtotal: number;
  impuesto: number;
  total: number;
  estado: string;
  numero_comprobante: string | null;
  pdf_base64: string | null;
  detalles: PurchaseItem[];
}

export default function PosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showScanner, setShowScanner] = useState(false);

  // Opciones de pago: efectivo, transferencia, fiado (sin tarjeta)
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "transferencia" | "fiado">("efectivo");
  const [montoRecibido, setMontoRecibido] = useState<string>("");
  const [comprobanteTransferencia, setComprobanteTransferencia] = useState<string>("");
  const [generarFactura, setGenerarFactura] = useState<boolean>(true);
  const [processing, setProcessing] = useState(false);

  // Estados de Búsqueda de Clientes
  const [docSearch, setDocSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Ventana emergente (Modal) para ingresar Cliente Nuevo
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [savingNewClient, setSavingNewClient] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    documento: "",
    nombre: "",
    email: "",
    telefono: "",
    direccion: "",
  });

  // Resultado de Venta y Factura Generada
  const [lastSale, setLastSale] = useState<{
    venta_id: number;
    total: number;
    vuelto: number;
    factura?: {
      numero_comprobante: string;
      cufe_hash?: string;
      clave_acceso?: string;
      estado_sri?: string;
      mensaje_sri?: string;
      email_enviado: boolean;
      pdf_base64?: string;
      xml?: string;
    } | null;
  } | null>(null);


  const [sriErrorAlert, setSriErrorAlert] = useState<{
    venta_id: number;
    mensaje: string;
  } | null>(null);
  const [retryingSri, setRetryingSri] = useState(false);


  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [categories, setCategories] = useState<{ id: number; nombre: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | "all">("all");

  // Historial de Facturas del Cliente Seleccionado
  const [customerInvoices, setCustomerInvoices] = useState<Purchase[]>([]);
  const [loadingCustomerInvoices, setLoadingCustomerInvoices] = useState(false);
  const [showInvoicesSection, setShowInvoicesSection] = useState(true);
  const [viewingPurchaseDetail, setViewingPurchaseDetail] = useState<Purchase | null>(null);

  // Estados de Impresión y Configuración de Impresora (Ticket vs A4)
  const [printVentaId, setPrintVentaId] = useState<number | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [autoTriggerPrint, setAutoTriggerPrint] = useState(false);
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>(DEFAULT_PRINTER_CONFIG);

  useEffect(() => {
    setPrinterConfig(getPrinterConfig());
  }, [showPrintModal]);

  const loadProductsAndCustomers = async () => {
    try {
      const [resProd, resCli, resCat] = await Promise.all([
        apiFetch<{ products: Product[] }>("/tenant/products.php"),
        apiFetch<{ customers: Customer[] }>("/tenant/customers.php"),
        apiFetch<{ categories: { id: number; nombre: string }[] }>("/tenant/categories.php"),
      ]);
      setProducts(
        (resProd.products || []).map((p) => ({
          ...p,
          precio_venta: Number(p.precio_venta),
          stock: Number(p.stock),
        }))
      );
      setAllCustomers(resCli.customers || []);
      setCategories(resCat.categories || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadProductsAndCustomers();
  }, []);

  // Cargar facturas del cliente seleccionado
  const loadCustomerInvoices = async (clienteId: number) => {
    setLoadingCustomerInvoices(true);
    try {
      const res = await apiFetch<{ cliente: any; compras: Purchase[] }>(
        `/tenant/customer-history.php?cliente_id=${clienteId}`
      );
      setCustomerInvoices(res.compras || []);
    } catch (err) {
      console.error("Error al cargar facturas del cliente:", err);
      setCustomerInvoices([]);
    } finally {
      setLoadingCustomerInvoices(false);
    }
  };

  // Búsqueda inteligente de clientes por Cédula, RUC o Nombre (instantánea local + API)
  const handleSearchCustomer = async (val: string) => {
    setDocSearch(val);
    const term = val.trim();
    if (term.length === 0) {
      setCustomerResults([]);
      setHasSearched(false);
      return;
    }

    setHasSearched(true);

    // 1. Coincidencia inmediata sobre clientes ya cargados
    const lowerTerm = term.toLowerCase();
    const cleanTerm = lowerTerm.replace(/[^0-9a-z]/g, "");
    const localMatches = allCustomers.filter((c) => {
      const doc = (c.documento || "").toLowerCase();
      const nom = (c.nombre || "").toLowerCase();
      const cleanDoc = doc.replace(/[^0-9a-z]/g, "");
      return (
        doc.includes(lowerTerm) ||
        nom.includes(lowerTerm) ||
        (cleanTerm.length > 0 && cleanDoc.includes(cleanTerm))
      );
    });

    setCustomerResults(localMatches);

    // 2. Consulta al servidor para sincronizar
    setSearchingCustomer(true);
    try {
      const res = await apiFetch<{ customers: Customer[] }>(
        `/tenant/customers.php?q=${encodeURIComponent(term)}`
      );
      const serverResults = res.customers || [];
      if (serverResults.length > 0) {
        setCustomerResults(serverResults);
        // Sincronizar clientes en caché
        setAllCustomers((prev) => {
          const map = new Map(prev.map((c) => [c.id, c]));
          serverResults.forEach((c) => map.set(c.id, c));
          return Array.from(map.values());
        });
      }
    } catch (e) {
      console.error("Error en búsqueda de clientes:", e);
    } finally {
      setSearchingCustomer(false);
    }
  };

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setCustomerResults([]);
    setHasSearched(false);
    setDocSearch(c.documento ? `${c.documento} - ${c.nombre}` : c.nombre);
    loadCustomerInvoices(c.id);
  };

  const handleResetCustomer = () => {
    setSelectedCustomer(null);
    setCustomerInvoices([]);
    setDocSearch("");
    setCustomerResults([]);
    setHasSearched(false);
  };

  const openNewClientModalWithTerm = () => {
    setNewClientForm({
      documento: docSearch.trim(),
      nombre: "",
      email: "",
      telefono: "",
      direccion: "",
    });
    setShowNewClientModal(true);
  };

  const handleSaveNewClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientForm.nombre.trim()) {
      alert("El nombre del cliente es obligatorio.");
      return;
    }
    setSavingNewClient(true);
    try {
      const res = await apiFetch("/tenant/customers.php", {
        method: "POST",
        body: JSON.stringify(newClientForm),
      });

      const nuevoCliente: Customer = {
        id: res.cliente_id,
        documento: newClientForm.documento || null,
        nombre: newClientForm.nombre,
        email: newClientForm.email || null,
        telefono: newClientForm.telefono || null,
        direccion: newClientForm.direccion || null,
        saldo_pendiente: 0,
      };

      setSelectedCustomer(nuevoCliente);
      setAllCustomers((prev) => [nuevoCliente, ...prev]);
      setDocSearch(
        nuevoCliente.documento
          ? `${nuevoCliente.documento} - ${nuevoCliente.nombre}`
          : nuevoCliente.nombre
      );
      setShowNewClientModal(false);
      setCustomerResults([]);
      setHasSearched(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingNewClient(false);
    }
  };

  // Filtrado de productos por categoría, nombre o código de barras
  const filtered = useMemo(() => {
    let list = products;
    if (selectedCategory !== "all") {
      list = list.filter((p) => p.categoria_id === selectedCategory);
    }
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter(
      (p) =>
        p.nombre.toLowerCase().includes(term) ||
        (p.codigo_barra && p.codigo_barra.toLowerCase().includes(term))
    );
  }, [products, search, selectedCategory]);

  const addToCart = (product: Product, qty: number = 1) => {
    if (product.stock <= 0) return;
    setCart((prev) => {
      const exists = prev.find((i) => i.id === product.id);
      if (exists) {
        const targetQty = exists.cantidad + qty;
        if (targetQty > product.stock) return prev;
        return prev.map((i) => (i.id === product.id ? { ...i, cantidad: targetQty } : i));
      }
      return [...prev, { ...product, cantidad: Math.min(qty, product.stock) }];
    });
  };

  const setCartItemExactQty = (productId: number, newQty: number, maxStock: number) => {
    if (newQty <= 0) {
      setCart((prev) => prev.filter((i) => i.id !== productId));
      return;
    }
    const finalQty = Math.min(newQty, maxStock);
    setCart((prev) =>
      prev.map((i) => (i.id === productId ? { ...i, cantidad: finalQty } : i))
    );
  };

  const updateQty = (id: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id !== id) return item;
          const nextQty = item.cantidad + delta;
          if (nextQty > item.stock) return item;
          return { ...item, cantidad: nextQty };
        })
        .filter((item) => item.cantidad > 0)
    );
  };

  // Manejador cuando la cámara detecta un código de barras
  const handleBarcodeScanned = (code: string) => {
    const found = products.find(
      (p) => p.codigo_barra && p.codigo_barra.toLowerCase() === code.toLowerCase()
    );
    if (found) {
      addToCart(found);
      setSearch(found.nombre);
    } else {
      setSearch(code);
      alert(`Código escaneado: "${code}". No se encontró coincidencia exacta, se filtrará en la lista.`);
    }
  };

  const total = useMemo(
    () => cart.reduce((acc, item) => acc + item.precio_venta * item.cantidad, 0),
    [cart]
  );

  const vuelto = useMemo(() => {
    if (metodoPago !== "efectivo") return 0;
    const recibido = parseFloat(montoRecibido) || 0;
    return Math.max(0, recibido - total);
  }, [montoRecibido, total, metodoPago]);

  const handleCobrarYFacturar = async () => {
    if (cart.length === 0) return;

    if (metodoPago === "fiado" && !selectedCustomer) {
      alert("Para registrar una venta a Crédito Directo debes buscar o ingresar un cliente.");
      return;
    }

    if (metodoPago === "transferencia" && !comprobanteTransferencia.trim()) {
      alert("Por favor ingrese el número de comprobante o depósito para el registro contable.");
      return;
    }

    const recibidoNum = metodoPago === "efectivo" ? parseFloat(montoRecibido) || total : total;
    if (metodoPago === "efectivo" && recibidoNum < total) {
      alert("El monto recibido en efectivo es menor al total a cobrar.");
      return;
    }

    setProcessing(true);
    setSriErrorAlert(null);
    try {
      const res = await apiFetch("/tenant/pos.php", {
        method: "POST",
        body: JSON.stringify({
          metodo_pago: metodoPago,
          comprobante_transferencia: comprobanteTransferencia.trim(),
          monto_recibido: recibidoNum,
          generar_factura: false, // Ahora se emite a través del flujo legal SRI
          cliente_id: selectedCustomer?.id || null,
          cliente_documento: selectedCustomer?.documento || "",
          cliente_nombre: selectedCustomer?.nombre || "Consumidor Final",
          cliente_email: selectedCustomer?.email || "",
          cliente_telefono: selectedCustomer?.telefono || "",
          cliente_direccion: selectedCustomer?.direccion || "",
          items: cart.map((i) => ({ producto_id: i.id, cantidad: i.cantidad })),
        }),
      });

      let sriFacturaInfo = null;

      // Si el usuario marcó Emitir Factura SRI, procesar en el endpoint legal SRI
      if (generarFactura) {
        try {
          const sriRes = await apiFetch("/sri/emitir-factura.php", {
            method: "POST",
            body: JSON.stringify({ venta_id: res.venta_id }),
          });

          sriFacturaInfo = {
            numero_comprobante: sriRes.numero_comprobante,
            clave_acceso: sriRes.clave_acceso,
            estado_sri: sriRes.estado_sri,
            mensaje_sri: sriRes.mensaje,
            email_enviado: sriRes.email_enviado,
            pdf_base64: sriRes.pdf_base64,
            xml: sriRes.xml_firmado,
          };

          if (sriRes.estado_sri !== "AUTORIZADO") {
            setSriErrorAlert({
              venta_id: res.venta_id,
              mensaje: sriRes.mensaje || `El SRI respondió en estado: ${sriRes.estado_sri}. La factura quedó guardada en la cola de reintentos automáticos.`,
            });
          }
        } catch (sriErr: any) {
          setSriErrorAlert({
            venta_id: res.venta_id,
            mensaje: sriErr.message || "No se pudo conectar con el servidor del SRI. Venta registrada con éxito.",
          });
        }
      }

      setLastSale({
        venta_id: res.venta_id,
        total: res.total,
        vuelto: res.vuelto,
        factura: sriFacturaInfo,
      });

      // Abrir inmediatamente la ventana de impresión de factura de forma automática al presionar Cobrar
      setPrintVentaId(res.venta_id);
      setAutoTriggerPrint(true);
      setShowPrintModal(true);

      setCart([]);
      setMontoRecibido("");
      setComprobanteTransferencia("");
      handleResetCustomer();
      loadProductsAndCustomers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleRetrySri = async (ventaId: number) => {
    setRetryingSri(true);
    try {
      const sriRes = await apiFetch("/sri/emitir-factura.php", {
        method: "POST",
        body: JSON.stringify({ venta_id: ventaId }),
      });

      if (sriRes?.estado_sri === "AUTORIZADO" || sriRes?.success) {
        alert("¡Factura AUTORIZADA legalmente por el SRI!");
        setSriErrorAlert(null);
        if (lastSale && lastSale.venta_id === ventaId) {
          setLastSale({
            ...lastSale,
            factura: {
              numero_comprobante: sriRes.numero_comprobante,
              clave_acceso: sriRes.clave_acceso,
              estado_sri: sriRes.estado_sri,
              mensaje_sri: sriRes.mensaje,
              email_enviado: sriRes.email_enviado,
              pdf_base64: sriRes.pdf_base64,
              xml: sriRes.xml_firmado,
            },
          });
        }
      } else {
        alert(
          "Resultado del reintento SRI: " +
            (sriRes?.mensaje || sriRes?.error || sriRes?.estado_sri || "Comprobante en procesamiento en el SRI.")
        );
      }
    } catch (e: any) {
      alert("Error al reintentar envío al SRI: " + (e?.message || "Error desconocido"));
    } finally {
      setRetryingSri(false);
    }
  };


  const downloadPdf = (base64Data: string, filename: string) => {
    const link = document.createElement("a");
    link.href = `data:application/pdf;base64,${base64Data}`;
    link.download = `${filename}.pdf`;
    link.click();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* 1. CATÁLOGO CON BÚSQUEDA POR NOMBRE Y CÁMARA (7 Columnas) */}
      <div className="lg:col-span-7 space-y-4">
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Buscar producto por nombre o código de barra..."
            className="w-full bg-transparent outline-none text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {/* Botón Escanear con Cámara */}
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-600 hover:text-white transition shrink-0"
            title="Escanear código de barra con cámara"
          >
            <Camera className="w-4 h-4" />
            <span className="hidden sm:inline">Escanear</span>
          </button>

          {/* Botón Configurar Impresora */}
          <button
            type="button"
            onClick={() => {
              setPrintVentaId(lastSale?.venta_id || null);
              setShowPrintModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
            title="Configuración de Impresora (Ticket / A4)"
          >
            <Printer className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden md:inline">
              {printerConfig.type === "ticket" ? `Ticket (${printerConfig.ticketWidth})` : "Impresora A4"}
            </span>
          </button>
        </div>

        {/* Modal de Cámara */}
        {showScanner && (
          <CameraBarcodeScanner
            onDetected={handleBarcodeScanned}
            onClose={() => setShowScanner(false)}
          />
        )}

        {/* Píldoras de Categorías en el POS */}
        {categories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1 rounded-xl text-xs font-bold shrink-0 transition ${
                selectedCategory === "all"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50"
              }`}
            >
              Todas ({products.length})
            </button>
            {categories.map((c) => {
              const count = products.filter((p) => p.categoria_id === c.id).length;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCategory(c.id)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold shrink-0 transition ${
                    selectedCategory === c.id
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {c.nombre} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Grid de Productos */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filtered.length === 0 ? (
            <div className="col-span-3 py-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              No se encontraron productos que coincidan con &quot;{search}&quot;.
            </div>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={p.stock <= 0}
                className="group text-left bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 active:scale-[0.98] disabled:opacity-40 transition flex flex-col justify-between h-36"
              >
                <div className="flex items-start justify-between gap-2 w-full">
                  <span className="font-semibold text-sm line-clamp-2">{p.nombre}</span>
                  {p.imagen_url && (
                    <img
                      src={p.imagen_url}
                      alt={p.nombre}
                      className="w-10 h-10 rounded-lg object-cover shrink-0"
                    />
                  )}
                </div>
                <div className="flex items-end justify-between w-full pt-2">
                  <span className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400">
                    ${p.precio_venta.toFixed(2)}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                    Stock: {p.stock}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* 2. PANEL DERECHO: TICKET, CLIENTE, CANTIDADES, VUELTO Y COBRO (5 Columnas) */}
      <div id="pos-cart-panel" className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 sticky top-4">
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2 font-bold">
            <ShoppingBag className="w-5 h-5 text-indigo-600" />
            <span>Punto de Venta & Facturación</span>
          </div>
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="text-xs text-red-500 hover:underline flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> Vaciar
            </button>
          )}
        </div>

        {/* Notificación de Factura / Venta Recién Creada */}
        {lastSale && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs space-y-2">
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                Venta #{lastSale.venta_id} completada
              </span>
              <button onClick={() => setLastSale(null)} className="font-bold text-sm">
                ✕
              </button>
            </div>
            {lastSale.factura && (
              <div className="space-y-1.5 pt-1 border-t border-emerald-200 dark:border-emerald-800/60">
                <div className="flex items-center justify-between">
                  <div>
                    <strong>Factura Legal SRI:</strong> {lastSale.factura.numero_comprobante}
                  </div>
                  {lastSale.factura.estado_sri && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        lastSale.factura.estado_sri === "AUTORIZADO"
                          ? "bg-emerald-200 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300"
                          : "bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-300"
                      }`}
                    >
                      {lastSale.factura.estado_sri}
                    </span>
                  )}
                </div>

                {lastSale.factura.clave_acceso && (
                  <div className="text-[10px] text-slate-500 font-mono break-all">
                    Clave Acceso: {lastSale.factura.clave_acceso}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-emerald-200 dark:border-emerald-800/60">
              <button
                type="button"
                onClick={() => {
                  setPrintVentaId(lastSale.venta_id);
                  setShowPrintModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir ({printerConfig.type === "ticket" ? `Ticket ${printerConfig.ticketWidth}` : "A4 Normal"})</span>
              </button>

              {lastSale.factura?.pdf_base64 && (
                <button
                  onClick={() =>
                    downloadPdf(
                      lastSale.factura!.pdf_base64!,
                      lastSale.factura!.numero_comprobante
                    )
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 text-xs"
                >
                  <Download className="w-3.5 h-3.5" /> Descargar RIDE (PDF)
                </button>
              )}

              {lastSale.factura?.email_enviado ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                  <Mail className="w-3.5 h-3.5" /> Enviada por correo
                </span>
              ) : null}
            </div>
          </div>
        )}

        {/* Alerta de Caída / Error del SRI con botón para Reintentar */}
        {sriErrorAlert && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <div className="font-bold">Aviso del SRI Ecuador (Venta guardada)</div>
                <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                  {sriErrorAlert.mensaje}
                </p>
                <div className="pt-1 flex items-center gap-2">
                  <button
                    onClick={() => handleRetrySri(sriErrorAlert.venta_id)}
                    disabled={retryingSri}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] transition shadow-sm"
                  >
                    <RefreshCw className={`w-3 h-3 ${retryingSri ? "animate-spin" : ""}`} />
                    <span>{retryingSri ? "Reintentando con SRI..." : "Reintentar Envío Ahora"}</span>
                  </button>
                  <span className="text-[10px] text-amber-700 dark:text-amber-400">
                    O se reintentará automáticamente cada 15 min.
                  </span>
                </div>
              </div>
              <button onClick={() => setSriErrorAlert(null)} className="font-bold text-sm text-amber-600">
                ✕
              </button>
            </div>
          </div>
        )}


        {/* BÚSQUEDA Y SELECCIÓN DE CLIENTE CON MODAL SI NO EXISTE */}
        <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-indigo-600" />
              Cliente
            </span>
            <button
              type="button"
              onClick={() => {
                setNewClientForm({ documento: "", nombre: "", email: "", telefono: "", direccion: "" });
                setShowNewClientModal(true);
              }}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1"
            >
              <UserPlus className="w-3.5 h-3.5" /> + Ingresar Nuevo
            </button>
          </div>

          {selectedCustomer ? (
            <div className="space-y-2.5">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-indigo-200 dark:border-indigo-900 flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-indigo-600 dark:text-indigo-400">
                    {selectedCustomer.nombre}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Cédula/RUC: {selectedCustomer.documento || "S/N"} • Tel: {selectedCustomer.telefono || "S/N"}
                  </div>
                  {selectedCustomer.direccion && (
                    <div className="text-[11px] text-slate-400 truncate max-w-[260px]">
                      Dir: {selectedCustomer.direccion}
                    </div>
                  )}
                  {Number(selectedCustomer.saldo_pendiente) > 0 && (
                    <div className="text-[11px] text-rose-600 font-bold mt-0.5">
                      Saldo en Crédito Directo: ${Number(selectedCustomer.saldo_pendiente).toFixed(2)}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleResetCustomer}
                  className="text-xs text-red-500 hover:underline font-semibold"
                >
                  Cambiar
                </button>
              </div>

              {/* LISTADO DE FACTURAS DEL CLIENTE SELECCIONADO */}
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  <span className="font-bold flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                    <Receipt className="w-3.5 h-3.5" />
                    Facturas de este cliente ({customerInvoices.length})
                  </span>
                  {customerInvoices.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowInvoicesSection(!showInvoicesSection)}
                      className="text-[11px] text-slate-500 hover:text-indigo-600 underline font-medium"
                    >
                      {showInvoicesSection ? "Ocultar" : "Mostrar"}
                    </button>
                  )}
                </div>

                {loadingCustomerInvoices ? (
                  <div className="py-3 text-center text-slate-400 text-[11px]">
                    Cargando facturas del cliente...
                  </div>
                ) : customerInvoices.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic py-1">
                    Este cliente aún no tiene facturas emitidas anteriormente.
                  </p>
                ) : showInvoicesSection ? (
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100 dark:divide-slate-800">
                    {customerInvoices.map((inv) => (
                      <div
                        key={inv.venta_id}
                        className="pt-2 first:pt-0 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-bold flex items-center gap-1.5 flex-wrap">
                            <span className="text-slate-800 dark:text-slate-100">
                              {inv.numero_comprobante || `Venta #${inv.venta_id}`}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                inv.metodo_pago === "fiado"
                                  ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                              }`}
                            >
                              {inv.metodo_pago === "fiado" ? "Crédito Directo" : inv.metodo_pago}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {inv.fecha} • <strong>${inv.total.toFixed(2)}</strong>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setPrintVentaId(inv.venta_id);
                              setShowPrintModal(true);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold transition shadow-sm"
                            title="Imprimir Factura / Ticket"
                          >
                            <Printer className="w-3 h-3" /> Imprimir
                          </button>
                          {inv.pdf_base64 && (
                            <button
                              type="button"
                              onClick={() =>
                                downloadPdf(
                                  inv.pdf_base64!,
                                  inv.numero_comprobante || `Factura_${inv.venta_id}`
                                )
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition shadow-sm"
                              title="Descargar Factura PDF"
                            >
                              <Download className="w-3 h-3" /> PDF
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setViewingPurchaseDetail(inv)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-[10px] font-medium"
                            title="Ver detalle de productos"
                          >
                            <Eye className="w-3 h-3" /> Ver
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="relative">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Buscar cliente por Cédula, RUC o Nombre..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                  value={docSearch}
                  onChange={(e) => handleSearchCustomer(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchCustomer(docSearch)}
                />
                <button
                  type="button"
                  onClick={() => handleSearchCustomer(docSearch)}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shrink-0 transition"
                >
                  Buscar
                </button>
              </div>

              {searchingCustomer && (
                <div className="text-[11px] text-slate-400 pt-1">Buscando cliente...</div>
              )}

              {/* Lista de sugerencias */}
              {customerResults.length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl divide-y divide-slate-100 dark:divide-slate-800">
                  {customerResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectCustomer(c)}
                      className="w-full text-left p-2.5 hover:bg-indigo-50 dark:hover:bg-slate-800 text-xs flex justify-between items-center transition"
                    >
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-100">
                          {c.nombre}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Cédula/RUC: {c.documento || "S/N"} • Tel: {c.telefono || "S/N"}
                        </div>
                      </div>
                      {Number(c.saldo_pendiente) > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-600 font-bold">
                          Deuda: ${Number(c.saldo_pendiente).toFixed(2)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Si buscó y no encontró nada: sugerir abrir modal de nuevo cliente */}
              {hasSearched && !searchingCustomer && customerResults.length === 0 && (
                <div className="mt-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>No se encontró ningún cliente con ese dato.</span>
                  </div>
                  <button
                    type="button"
                    onClick={openNewClientModalWithTerm}
                    className="font-bold underline text-indigo-600 dark:text-indigo-400 shrink-0 ml-2"
                  >
                    Crear Ahora
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ÍTEMS DEL CARRITO CON ESCOGER CANTIDADES */}
        <div className="max-h-56 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
          {cart.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">
              Toca productos del catálogo para agregarlos al ticket.
            </p>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{item.nombre}</div>
                  <div className="text-[11px] text-slate-400">
                    ${item.precio_venta.toFixed(2)} c/u • Disp: {item.stock}
                  </div>
                </div>

                {/* Controles de cantidad ajustables con input directo o botones */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => updateQty(item.id, -1)}
                    className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={item.stock}
                    className="w-12 text-center font-bold px-1 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent text-xs"
                    value={item.cantidad}
                    onChange={(e) =>
                      setCartItemExactQty(item.id, parseInt(e.target.value) || 0, item.stock)
                    }
                  />
                  <button
                    onClick={() => updateQty(item.id, 1)}
                    className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <div className="w-16 text-right font-bold text-sm">
                  ${(item.precio_venta * item.cantidad).toFixed(2)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* MÉTODOS DE PAGO: Efectivo, Transferencia o Fiado (SIN TARJETA) */}
        <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
            Método de Pago
          </label>
          <div className="grid grid-cols-3 gap-2 text-xs font-bold">
            <button
              type="button"
              onClick={() => setMetodoPago("efectivo")}
              className={`py-2 rounded-xl border flex items-center justify-center gap-1.5 transition ${
                metodoPago === "efectivo"
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "border-slate-200 dark:border-slate-700"
              }`}
            >
              <Banknote className="w-4 h-4" /> Efectivo
            </button>
            <button
              type="button"
              onClick={() => setMetodoPago("transferencia")}
              className={`py-2 rounded-xl border flex items-center justify-center gap-1.5 transition ${
                metodoPago === "transferencia"
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "border-slate-200 dark:border-slate-700"
              }`}
            >
              <Send className="w-4 h-4" /> Transf.
            </button>
            <button
              type="button"
              onClick={() => setMetodoPago("fiado")}
              className={`py-2 rounded-xl border flex items-center justify-center gap-1.5 transition ${
                metodoPago === "fiado"
                  ? "bg-rose-600 text-white border-rose-600"
                  : "border-slate-200 dark:border-slate-700 text-rose-500"
              }`}
            >
              <Clock className="w-4 h-4" /> Crédito Directo
            </button>
          </div>

          {/* EFECTIVO: BOTONES RÁPIDOS DE BILLETES Y TEXTO DE VUELTO BIEN GRANDE */}
          {metodoPago === "efectivo" && (
            <div className="space-y-2.5 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                Efectivo recibido ($)
              </label>

              <input
                type="number"
                step="0.01"
                placeholder={total.toFixed(2)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg font-extrabold outline-none focus:ring-2 focus:ring-indigo-500"
                value={montoRecibido}
                onChange={(e) => setMontoRecibido(e.target.value)}
              />

              {/* Botones rápidos de billetes comunes */}
              <div className="flex flex-wrap gap-1.5">
                {[total, 5, 10, 20, 50, 100].map((val, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setMontoRecibido(val.toFixed(2))}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-600 transition"
                  >
                    {idx === 0 ? "Exacto" : `$${val}`}
                  </button>
                ))}
              </div>

              {/* TEXTO DE VUELTO GRANDE Y DESTACADO */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80 flex items-baseline justify-between">
                <span className="text-sm font-bold text-slate-500 uppercase tracking-wide">
                  Vuelto a entregar:
                </span>
                <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                  ${vuelto.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {metodoPago === "transferencia" && (
            <div className="space-y-2 bg-blue-50/70 dark:bg-blue-950/40 p-3.5 rounded-2xl border border-blue-200 dark:border-blue-800/80">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-blue-900 dark:text-blue-300">
                  N° Comprobante / Depósito <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                  Contabilidad Bancos
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ej: 00984572 / DEP-102938"
                  value={comprobanteTransferencia}
                  onChange={(e) => setComprobanteTransferencia(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  required
                />
              </div>
              <p className="text-[11px] text-blue-700 dark:text-blue-400 leading-tight">
                Se guardará y vinculará directamente al asiento contable de la cuenta <strong>1.1.01.02 (Bancos)</strong>.
              </p>
            </div>
          )}

          {metodoPago === "fiado" && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
              Esta venta se anotará en la cuenta de <strong>{selectedCustomer ? selectedCustomer.nombre : "cliente seleccionado"}</strong> como Crédito Directo (cuenta por cobrar).
            </div>
          )}

          {/* Opciones de Factura Electrónica Legal SRI */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
            <label className="flex items-center gap-2 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={generarFactura}
                onChange={(e) => setGenerarFactura(e.target.checked)}
                className="rounded"
              />
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>Emitir Factura Legal (SRI Ecuador - RIDE + XML)</span>
            </label>
          </div>


          {/* Total */}
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 flex justify-between items-center text-lg font-extrabold">
            <span>Total a Cobrar</span>
            <span className="text-indigo-600 dark:text-indigo-400">${total.toFixed(2)}</span>
          </div>

          {/* Botón Principal */}
          <button
            onClick={handleCobrarYFacturar}
            disabled={cart.length === 0 || processing}
            className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-sm transition flex items-center justify-center gap-2"
          >
            {processing ? (
              "Procesando venta y factura..."
            ) : (
              <>
                <span>
                  {metodoPago === "fiado" ? "Registrar Crédito Directo" : "Cobrar"} ${total.toFixed(2)}
                </span>
                {generarFactura && <span>+ Emitir Factura</span>}
              </>
            )}
          </button>
        </div>
      </div>

      {/* VENTANA EMERGENTE (MODAL) PARA INGRESAR CLIENTE NUEVO */}
      {showNewClientModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600">
                  <UserPlus className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base">Registrar Nuevo Cliente</h3>
              </div>
              <button
                onClick={() => setShowNewClientModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewClient} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-slate-600 dark:text-slate-300">
                  Nombre Completo / Razón Social *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Juan Pérez"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  value={newClientForm.nombre}
                  onChange={(e) =>
                    setNewClientForm({ ...newClientForm, nombre: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-600 dark:text-slate-300">
                    Cédula / RUC / NIT
                  </label>
                  <input
                    type="text"
                    placeholder="0999999999"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newClientForm.documento}
                    onChange={(e) =>
                      setNewClientForm({ ...newClientForm, documento: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-600 dark:text-slate-300">
                    Teléfono / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="099887766"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newClientForm.telefono}
                    onChange={(e) =>
                      setNewClientForm({ ...newClientForm, telefono: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-600 dark:text-slate-300">
                  Correo Electrónico (para Factura PDF/XML)
                </label>
                <input
                  type="email"
                  placeholder="cliente@correo.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newClientForm.email}
                  onChange={(e) =>
                    setNewClientForm({ ...newClientForm, email: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-600 dark:text-slate-300">
                  Dirección Domiciliaria
                </label>
                <input
                  type="text"
                  placeholder="Calle Principal #123 y Secundaria"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newClientForm.direccion}
                  onChange={(e) =>
                    setNewClientForm({ ...newClientForm, direccion: e.target.value })
                  }
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewClientModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingNewClient}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition"
                >
                  {savingNewClient ? "Guardando..." : "Guardar y Seleccionar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VER PRODUCTOS DE LA FACTURA SELECCIONADA */}
      {viewingPurchaseDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 space-y-4 text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <div>
                <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">
                  {viewingPurchaseDetail.numero_comprobante || `Venta #${viewingPurchaseDetail.venta_id}`}
                </h3>
                <p className="text-[11px] text-slate-500">{viewingPurchaseDetail.fecha}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewingPurchaseDetail(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {(viewingPurchaseDetail.detalles || []).map((det, idx) => (
                <div key={idx} className="pt-2 first:pt-0 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold">{det.nombre_producto}</span>
                    <span className="text-slate-400 ml-1 text-[11px]">x{det.cantidad}</span>
                  </div>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    ${Number(det.subtotal).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center font-bold text-sm">
              <span>Total:</span>
              <span className="text-indigo-600 dark:text-indigo-400">
                ${viewingPurchaseDetail.total.toFixed(2)}
              </span>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPrintVentaId(viewingPurchaseDetail.venta_id);
                  setShowPrintModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" /> Imprimir Comprobante
              </button>
              {viewingPurchaseDetail.pdf_base64 && (
                <button
                  type="button"
                  onClick={() =>
                    downloadPdf(
                      viewingPurchaseDetail!.pdf_base64!,
                      viewingPurchaseDetail!.numero_comprobante || `Factura_${viewingPurchaseDetail!.venta_id}`
                    )
                  }
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Descargar Factura PDF
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewingPurchaseDetail(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Floating Cart Action Pill */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40 animate-in slide-in-from-bottom-4">
          <button
            type="button"
            onClick={() => {
              document.getElementById("pos-cart-panel")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-3.5 rounded-2xl shadow-2xl flex items-center justify-between font-bold text-sm border border-indigo-400 active:scale-98 transition"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              <span>Ver Carrito ({cart.reduce((a, b) => a + b.cantidad, 0)} ítems)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-base">${total.toFixed(2)}</span>
              <span className="bg-white/20 px-2 py-0.5 rounded-lg text-xs">Cobrar →</span>
            </div>
          </button>
        </div>
      )}

      {/* MODAL DE IMPRESIÓN Y CONFIGURACIÓN DE IMPRESORA (TICKET / A4) */}
      <InvoicePrintModal
        isOpen={showPrintModal}
        onClose={() => {
          setShowPrintModal(false);
          setAutoTriggerPrint(false);
        }}
        ventaId={printVentaId}
        autoTriggerPrint={autoTriggerPrint}
      />
    </div>
  );
}
