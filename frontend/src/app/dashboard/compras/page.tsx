"use client";

import { useEffect, useState, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import {
  Truck,
  Plus,
  Search,
  Calendar,
  FileText,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  X,
  Trash2,
  Eye,
  Building2,
  Phone,
  Mail,
  MapPin,
  BookOpen,
  Receipt,
  ArrowUpDown,
  Filter,
  Ban,
  Clock,
  Layers,
} from "lucide-react";

interface Supplier {
  id: number;
  ruc: string;
  razon_social: string;
  nombre_comercial: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  cuenta_por_pagar_id: number | null;
  cuenta_codigo?: string | null;
  cuenta_nombre?: string | null;
  total_compras: number;
  total_facturado: number | string;
  activo: number;
}

interface PurchaseItem {
  id?: number;
  producto_id: number;
  nombre_producto: string;
  cantidad: number;
  costo_unitario: number;
  subtotal: number;
  tarifa_iva: number;
  valor_iva: number;
  total: number;
}

interface Purchase {
  id: number;
  numero_factura: string;
  fecha_emision: string;
  metodo_pago: "efectivo" | "transferencia" | "credito";
  subtotal_15: number | string;
  subtotal_0: number | string;
  iva: number | string;
  total: number | string;
  retencion_renta: number | string;
  retencion_iva: number | string;
  total_pagar: number | string;
  estado: "registrada" | "anulada";
  asiento_id: number | null;
  asiento_numero?: number | null;
  observaciones: string | null;
  proveedor_ruc: string;
  proveedor_nombre: string;
  usuario_nombre: string;
  total_items?: number;
  detalles?: PurchaseItem[];
}

interface Product {
  id: number;
  nombre: string;
  codigo_barra: string | null;
  precio_compra: number | string;
  stock: number;
  sri_tarifa_iva?: number | string;
}

interface Account {
  id: number;
  codigo: string;
  nombre: string;
  tipo: string;
}

export default function ComprasPage() {
  const [tab, setTab] = useState<"compras" | "proveedores">("compras");

  // Datos principales
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros de Compras
  const [q, setQ] = useState("");
  const [filterProv, setFilterProv] = useState<string>("");
  const [filterEstado, setFilterEstado] = useState<string>("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  // Modal Nueva Compra
  const [newPurchaseModal, setNewPurchaseModal] = useState(false);
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({
    proveedor_id: "",
    numero_factura: "",
    fecha_emision: new Date().toISOString().split("T")[0],
    metodo_pago: "transferencia" as "efectivo" | "transferencia" | "credito",
    retencion_renta: "0.00",
    retencion_iva: "0.00",
    observaciones: "",
    items: [] as PurchaseItem[],
  });

  // Fila para agregar item a la compra
  const [selectedProductId, setSelectedProductId] = useState("");
  const [itemCant, setItemCant] = useState("1");
  const [itemCosto, setItemCosto] = useState("");
  const [itemTarifaIva, setItemTarifaIva] = useState("15");

  // Modal Detalle de Compra
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Modal Anular Compra
  const [voidModalPurchase, setVoidModalPurchase] = useState<Purchase | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);

  // Modal Proveedor (Crear / Editar)
  const [supplierModal, setSupplierModal] = useState(false);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    id: 0,
    ruc: "",
    razon_social: "",
    nombre_comercial: "",
    email: "",
    telefono: "",
    direccion: "",
    cuenta_por_pagar_id: "",
  });

  // Filtro de proveedores
  const [supplierQ, setSupplierQ] = useState("");

  // Notificación tipo toast
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [resPurchases, resSuppliers, resProducts, resAccounts] = await Promise.all([
        apiFetch<{ purchases: Purchase[] }>("/tenant/purchases.php"),
        apiFetch<{ suppliers: Supplier[] }>("/tenant/suppliers.php"),
        apiFetch<{ products: Product[] }>("/tenant/products.php"),
        apiFetch<{ accounts: Account[] }>("/tenant/accounting/accounts.php?movimiento=1").catch(() => ({ accounts: [] })),
      ]);

      setPurchases(resPurchases.purchases || []);
      setSuppliers(resSuppliers.suppliers || []);
      setProducts(resProducts.products || []);
      setAccounts(resAccounts.accounts || []);
    } catch (e: any) {
      showToast(e.message || "Error al cargar datos", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const reloadPurchases = async () => {
    try {
      let url = `/tenant/purchases.php?q=${encodeURIComponent(q)}`;
      if (filterProv) url += `&proveedor_id=${filterProv}`;
      if (filterEstado) url += `&estado=${filterEstado}`;
      if (fechaInicio) url += `&fecha_inicio=${fechaInicio}`;
      if (fechaFin) url += `&fecha_fin=${fechaFin}`;
      const res = await apiFetch<{ purchases: Purchase[] }>(url);
      setPurchases(res.purchases || []);
    } catch (e: any) {
      console.error(e);
    }
  };

  const reloadSuppliers = async () => {
    try {
      const res = await apiFetch<{ suppliers: Supplier[] }>(`/tenant/suppliers.php?q=${encodeURIComponent(supplierQ)}`);
      setSuppliers(res.suppliers || []);
    } catch (e: any) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!loading) reloadPurchases();
  }, [q, filterProv, filterEstado, fechaInicio, fechaFin]);

  useEffect(() => {
    if (!loading) reloadSuppliers();
  }, [supplierQ]);

  // Totales y estadísticas del mes
  const stats = useMemo(() => {
    let totalCompras = 0;
    let totalIvaCredito = 0;
    let activasCount = 0;

    purchases.forEach((p) => {
      if (p.estado === "registrada") {
        totalCompras += Number(p.total);
        totalIvaCredito += Number(p.iva);
        activasCount++;
      }
    });

    return {
      totalCompras,
      totalIvaCredito,
      activasCount,
      proveedoresCount: suppliers.length,
    };
  }, [purchases, suppliers]);

  // Al seleccionar producto en el modal de nueva compra
  const handleSelectProduct = (prodId: string) => {
    setSelectedProductId(prodId);
    if (!prodId) return;
    const p = products.find((x) => x.id === Number(prodId));
    if (p) {
      setItemCosto(Number(p.precio_compra) > 0 ? Number(p.precio_compra).toFixed(4) : "");
      setItemTarifaIva(Number(p.sri_tarifa_iva) === 0 ? "0" : "15");
    }
  };

  // Agregar item a la compra
  const handleAddItem = () => {
    if (!selectedProductId) {
      showToast("Selecciona un producto del catálogo.", "error");
      return;
    }
    const cant = parseInt(itemCant, 10);
    const costo = parseFloat(itemCosto);
    const tarifa = parseFloat(itemTarifaIva);

    if (isNaN(cant) || cant <= 0) {
      showToast("La cantidad debe ser mayor a 0.", "error");
      return;
    }
    if (isNaN(costo) || costo <= 0) {
      showToast("Ingresa un costo unitario válido.", "error");
      return;
    }

    const prod = products.find((x) => x.id === Number(selectedProductId));
    if (!prod) return;

    const subtotal = Math.round(cant * costo * 100) / 100;
    const valorIva = tarifa > 0 ? Math.round((subtotal * tarifa) / 100 * 100) / 100 : 0.00;
    const total = Math.round((subtotal + valorIva) * 100) / 100;

    const newItem: PurchaseItem = {
      producto_id: prod.id,
      nombre_producto: prod.nombre,
      cantidad: cant,
      costo_unitario: costo,
      subtotal,
      tarifa_iva: tarifa,
      valor_iva: valorIva,
      total,
    };

    setPurchaseForm((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));

    // Reset fila de item
    setSelectedProductId("");
    setItemCant("1");
    setItemCosto("");
    setItemTarifaIva("15");
  };

  const handleRemoveItem = (index: number) => {
    setPurchaseForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  // Cálculos en tiempo real de la compra actual
  const purchaseCalculations = useMemo(() => {
    let subtotal15 = 0;
    let subtotal0 = 0;
    let iva = 0;

    purchaseForm.items.forEach((it) => {
      if (it.tarifa_iva > 0) {
        subtotal15 += it.subtotal;
      } else {
        subtotal0 += it.subtotal;
      }
      iva += it.valor_iva;
    });

    subtotal15 = Math.round(subtotal15 * 100) / 100;
    subtotal0 = Math.round(subtotal0 * 100) / 100;
    iva = Math.round(iva * 100) / 100;
    const totalFactura = Math.round((subtotal15 + subtotal0 + iva) * 100) / 100;

    const retRenta = parseFloat(purchaseForm.retencion_renta) || 0;
    const retIva = parseFloat(purchaseForm.retencion_iva) || 0;
    const totalPagar = Math.max(0, Math.round((totalFactura - retRenta - retIva) * 100) / 100);

    return { subtotal15, subtotal0, iva, totalFactura, totalPagar };
  }, [purchaseForm.items, purchaseForm.retencion_renta, purchaseForm.retencion_iva]);

  // Guardar Compra
  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseForm.proveedor_id) {
      showToast("Selecciona el proveedor.", "error");
      return;
    }
    if (!purchaseForm.numero_factura.trim()) {
      showToast("Ingresa el número de factura del proveedor.", "error");
      return;
    }
    if (purchaseForm.items.length === 0) {
      showToast("Debes añadir al menos un producto a la compra.", "error");
      return;
    }

    setSavingPurchase(true);
    try {
      const res = await apiFetch<{ message: string; compra_id: number; asiento_id: number | null }>("/tenant/purchases.php", {
        method: "POST",
        body: JSON.stringify({
          proveedor_id: Number(purchaseForm.proveedor_id),
          numero_factura: purchaseForm.numero_factura.trim(),
          fecha_emision: purchaseForm.fecha_emision,
          metodo_pago: purchaseForm.metodo_pago,
          retencion_renta: parseFloat(purchaseForm.retencion_renta) || 0,
          retencion_iva: parseFloat(purchaseForm.retencion_iva) || 0,
          observaciones: purchaseForm.observaciones.trim(),
          items: purchaseForm.items.map((it) => ({
            producto_id: it.producto_id,
            cantidad: it.cantidad,
            costo_unitario: it.costo_unitario,
            tarifa_iva: it.tarifa_iva,
          })),
        }),
      });

      showToast(`¡Compra #${res.compra_id} registrada con éxito! Asiento Contable #${res.asiento_id ?? "automático"} generado.`, "success");
      setNewPurchaseModal(false);
      setPurchaseForm({
        proveedor_id: "",
        numero_factura: "",
        fecha_emision: new Date().toISOString().split("T")[0],
        metodo_pago: "transferencia",
        retencion_renta: "0.00",
        retencion_iva: "0.00",
        observaciones: "",
        items: [],
      });
      loadAll();
    } catch (e: any) {
      showToast(e.message || "Error al registrar compra", "error");
    } finally {
      setSavingPurchase(false);
    }
  };

  // Ver Detalle de Compra
  const handleViewDetail = async (compraId: number) => {
    setLoadingDetail(true);
    setSelectedPurchase(null);
    try {
      const res = await apiFetch<{ purchase: Purchase }>(`/tenant/purchases.php?id=${compraId}`);
      setSelectedPurchase(res.purchase);
    } catch (e: any) {
      showToast(e.message || "Error al cargar detalle", "error");
    } finally {
      setLoadingDetail(false);
    }
  };

  // Anular Compra
  const handleConfirmVoid = async () => {
    if (!voidModalPurchase) return;
    setVoiding(true);
    try {
      const res = await apiFetch<{ message: string; asiento_reversion?: any }>("/tenant/purchases.php", {
        method: "PATCH",
        body: JSON.stringify({
          id: voidModalPurchase.id,
          motivo: voidReason.trim() || "Anulación manual por el usuario",
        }),
      });
      showToast(res.message || "Compra anulada y stock revertido.", "success");
      setVoidModalPurchase(null);
      setVoidReason("");
      loadAll();
    } catch (e: any) {
      showToast(e.message || "Error al anular compra", "error");
    } finally {
      setVoiding(false);
    }
  };

  // Guardar Proveedor
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm.ruc.trim() || !supplierForm.razon_social.trim()) {
      showToast("RUC y Razón Social son requeridos.", "error");
      return;
    }

    setSavingSupplier(true);
    try {
      const res = await apiFetch<{ message: string }>("/tenant/suppliers.php", {
        method: "POST",
        body: JSON.stringify({
          id: supplierForm.id,
          ruc: supplierForm.ruc.trim(),
          razon_social: supplierForm.razon_social.trim(),
          nombre_comercial: supplierForm.nombre_comercial.trim(),
          email: supplierForm.email.trim(),
          telefono: supplierForm.telefono.trim(),
          direccion: supplierForm.direccion.trim(),
          cuenta_por_pagar_id: supplierForm.cuenta_por_pagar_id ? Number(supplierForm.cuenta_por_pagar_id) : null,
        }),
      });

      showToast(res.message || "Proveedor guardado.", "success");
      setSupplierModal(false);
      reloadSuppliers();
    } catch (e: any) {
      showToast(e.message || "Error al guardar proveedor", "error");
    } finally {
      setSavingSupplier(false);
    }
  };

  const handleEditSupplier = (s: Supplier) => {
    setSupplierForm({
      id: s.id,
      ruc: s.ruc,
      razon_social: s.razon_social,
      nombre_comercial: s.nombre_comercial || "",
      email: s.email || "",
      telefono: s.telefono || "",
      direccion: s.direccion || "",
      cuenta_por_pagar_id: s.cuenta_por_pagar_id ? String(s.cuenta_por_pagar_id) : "",
    });
    setSupplierModal(true);
  };

  const handleDeleteSupplier = async (s: Supplier) => {
    if (!confirm(`¿Estás seguro de eliminar o desactivar al proveedor "${s.razon_social}"?`)) return;
    try {
      const res = await apiFetch<{ message: string }>(`/tenant/suppliers.php?id=${s.id}`, { method: "DELETE" });
      showToast(res.message || "Proveedor eliminado.", "success");
      reloadSuppliers();
    } catch (e: any) {
      showToast(e.message || "Error al eliminar proveedor", "error");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl border text-sm font-semibold flex items-center gap-2 transition animate-in fade-in slide-in-from-top-4 ${
            toast.type === "success"
              ? "bg-emerald-600 text-white border-emerald-500"
              : "bg-red-600 text-white border-red-500"
          }`}
        >
          {toast.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Header y Selector de Pestaña */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Truck className="w-7 h-7 text-indigo-600" />
            Compras a Proveedores & Abastecimiento
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Control de facturas de compra, ingreso al inventario con Costo Ponderado y asientos contables automáticos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {tab === "compras" ? (
            <button
              onClick={() => setNewPurchaseModal(true)}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm transition active:scale-95"
            >
              <Plus className="w-4 h-4" /> Registrar Compra
            </button>
          ) : (
            <button
              onClick={() => {
                setSupplierForm({
                  id: 0,
                  ruc: "",
                  razon_social: "",
                  nombre_comercial: "",
                  email: "",
                  telefono: "",
                  direccion: "",
                  cuenta_por_pagar_id: "",
                });
                setSupplierModal(true);
              }}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm transition active:scale-95"
            >
              <Plus className="w-4 h-4" /> Nuevo Proveedor
            </button>
          )}
        </div>
      </div>

      {/* Tarjetas de Métricas Rápidas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Compras Realizadas</span>
            <Receipt className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            ${stats.totalCompras.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            {stats.activasCount} facturas registradas
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Crédito Tributario IVA 15%</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">
            ${stats.totalIvaCredito.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-slate-500 font-medium">Deducible para declaración SRI</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Proveedores Registrados</span>
            <Building2 className="w-4 h-4 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{stats.proveedoresCount}</p>
          <span className="text-[11px] text-slate-500 font-medium">Directorio empresarial</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Integración Contable</span>
            <BookOpen className="w-4 h-4 text-purple-500" />
          </div>
          <p className="mt-2 text-lg font-bold text-purple-600 dark:text-purple-400">Partida Doble NIIF</p>
          <span className="text-[11px] text-slate-500 font-medium">Asiento automático en Libro Diario</span>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setTab("compras")}
          className={`px-4 py-3 font-bold text-sm border-b-2 flex items-center gap-2 transition ${
            tab === "compras"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Receipt className="w-4 h-4" />
          Facturas de Compras ({purchases.length})
        </button>

        <button
          onClick={() => setTab("proveedores")}
          className={`px-4 py-3 font-bold text-sm border-b-2 flex items-center gap-2 transition ${
            tab === "proveedores"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Building2 className="w-4 h-4" />
          Proveedores ({suppliers.length})
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: LISTADO DE COMPRAS */}
      {/* ========================================================= */}
      {tab === "compras" && (
        <div className="space-y-4">
          {/* Barra de Filtros */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por # factura, proveedor o RUC..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filterProv}
                onChange={(e) => setFilterProv(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none"
              >
                <option value="">Todos los Proveedores</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.razon_social}
                  </option>
                ))}
              </select>

              <select
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none"
              >
                <option value="">Todos los Estados</option>
                <option value="registrada">Registrada</option>
                <option value="anulada">Anulada</option>
              </select>

              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                title="Fecha Desde"
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none"
              />

              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                title="Fecha Hasta"
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none"
              />

              {(q || filterProv || filterEstado || fechaInicio || fechaFin) && (
                <button
                  onClick={() => {
                    setQ("");
                    setFilterProv("");
                    setFilterEstado("");
                    setFechaInicio("");
                    setFechaFin("");
                  }}
                  className="px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-xl transition"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Tabla de Facturas de Compras */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Factura SRI</th>
                    <th className="py-3 px-4">Proveedor</th>
                    <th className="py-3 px-4">Pago</th>
                    <th className="py-3 px-4 text-right">Subtotal</th>
                    <th className="py-3 px-4 text-right">IVA 15%</th>
                    <th className="py-3 px-4 text-right">Total Factura</th>
                    <th className="py-3 px-4 text-center">Asiento</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {purchases.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400 text-sm">
                        No hay compras registradas con los filtros actuales.
                      </td>
                    </tr>
                  ) : (
                    purchases.map((p) => {
                      const isAnulada = p.estado === "anulada";
                      return (
                        <tr
                          key={p.id}
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition ${
                            isAnulada ? "opacity-60 bg-slate-50/40 dark:bg-slate-900/40" : ""
                          }`}
                        >
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-600 dark:text-slate-300">
                            {p.fecha_emision}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-xs text-slate-900 dark:text-white">
                            {p.numero_factura}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">
                              {p.proveedor_nombre}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400">{p.proveedor_ruc}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold capitalize bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {p.metodo_pago}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-xs">
                            ${(Number(p.subtotal_15) + Number(p.subtotal_0)).toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                            ${Number(p.iva).toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-sm text-slate-900 dark:text-white">
                            ${Number(p.total).toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {p.asiento_numero ? (
                              <span
                                title={`Asiento Contable #${p.asiento_numero}`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 font-mono"
                              >
                                #{p.asiento_numero}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                isAnulada
                                  ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              }`}
                            >
                              {p.estado}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleViewDetail(p.id)}
                                title="Ver detalle de factura y productos"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {!isAnulada && (
                                <button
                                  onClick={() => {
                                    setVoidModalPurchase(p);
                                    setVoidReason("");
                                  }}
                                  title="Anular compra (reversar stock y contabilidad)"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                                >
                                  <Ban className="w-4 h-4" />
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
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: DIRECTORIO DE PROVEEDORES */}
      {/* ========================================================= */}
      {tab === "proveedores" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-3 justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar proveedor por RUC o Razón Social..."
                value={supplierQ}
                onChange={(e) => setSupplierQ(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                No hay proveedores registrados. ¡Crea el primero con el botón superior!
              </div>
            ) : (
              suppliers.map((s) => (
                <div
                  key={s.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:border-indigo-400 transition flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950">
                        {s.ruc}
                      </span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {s.total_compras} compras
                      </span>
                    </div>

                    <h3 className="font-bold text-base text-slate-900 dark:text-white line-clamp-1">
                      {s.razon_social}
                    </h3>
                    {s.nombre_comercial && (
                      <p className="text-xs text-slate-500 line-clamp-1 italic font-medium">
                        &quot;{s.nombre_comercial}&quot;
                      </p>
                    )}

                    <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {s.telefono && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{s.telefono}</span>
                        </div>
                      )}
                      {s.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span className="truncate">{s.email}</span>
                        </div>
                      )}
                      {s.direccion && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="line-clamp-1">{s.direccion}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">Total Comprado</div>
                      <div className="font-mono font-bold text-slate-900 dark:text-white">
                        ${Number(s.total_facturado).toFixed(2)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditSupplier(s)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700 transition"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteSupplier(s)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: REGISTRAR NUEVA COMPRA A PROVEEDOR */}
      {/* ========================================================= */}
      {newPurchaseModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-6 my-8 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/80 rounded-2xl text-indigo-600">
                  <Receipt className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Registrar Compra / Factura Proveedor</h2>
                  <p className="text-xs text-slate-500">
                    Aumenta inventario con costo promedio e ingresa el asiento contable de forma automática.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setNewPurchaseModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePurchase} className="space-y-6">
              {/* Datos de Cabecera */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Proveedor <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={purchaseForm.proveedor_id}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, proveedor_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Selecciona Proveedor...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.razon_social} ({s.ruc})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    N° Factura SRI <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="001-001-000012345"
                    value={purchaseForm.numero_factura}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, numero_factura: e.target.value })}
                    className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Fecha de Emisión <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={purchaseForm.fecha_emision}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, fecha_emision: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Método de Pago <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={purchaseForm.metodo_pago}
                    onChange={(e) =>
                      setPurchaseForm({
                        ...purchaseForm,
                        metodo_pago: e.target.value as "efectivo" | "transferencia" | "credito",
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="transferencia">Transferencia Bancaria</option>
                    <option value="efectivo">Efectivo / Caja</option>
                    <option value="credito">Crédito Proveedor (CxP)</option>
                  </select>
                </div>
              </div>

              {/* Agregar Producto a la Compra */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                  Agregar Ítems a la Factura
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-5 space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Producto</label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => handleSelectProduct(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none"
                    >
                      <option value="">Seleccionar Producto...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} (Stock actual: {p.stock})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Cantidad</label>
                    <input
                      type="number"
                      min="1"
                      value={itemCant}
                      onChange={(e) => setItemCant(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Costo Unit. ($)</label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      placeholder="0.00"
                      value={itemCosto}
                      onChange={(e) => setItemCosto(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Tarifa IVA</label>
                    <select
                      value={itemTarifaIva}
                      onChange={(e) => setItemTarifaIva(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:outline-none"
                    >
                      <option value="15">15% IVA</option>
                      <option value="0">0% IVA</option>
                    </select>
                  </div>

                  <div className="sm:col-span-1">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow-sm transition"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabla de Ítems Agregados */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold uppercase text-[10px] text-slate-500">
                    <tr>
                      <th className="py-2.5 px-4">Producto</th>
                      <th className="py-2.5 px-4 text-center">Cant.</th>
                      <th className="py-2.5 px-4 text-right">Costo Unit.</th>
                      <th className="py-2.5 px-4 text-center">Tarifa IVA</th>
                      <th className="py-2.5 px-4 text-right">IVA</th>
                      <th className="py-2.5 px-4 text-right">Total</th>
                      <th className="py-2.5 px-4 text-center">Quitar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {purchaseForm.items.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-400 italic">
                          Añade productos a la compra usando el selector superior.
                        </td>
                      </tr>
                    ) : (
                      purchaseForm.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                            {it.nombre_producto}
                          </td>
                          <td className="py-2.5 px-4 text-center font-mono font-bold">{it.cantidad}</td>
                          <td className="py-2.5 px-4 text-right font-mono">${it.costo_unitario.toFixed(4)}</td>
                          <td className="py-2.5 px-4 text-center font-bold">
                            {it.tarifa_iva > 0 ? (
                              <span className="text-emerald-600">15%</span>
                            ) : (
                              <span className="text-slate-400">0%</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono">${it.valor_iva.toFixed(2)}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold">${it.total.toFixed(2)}</td>
                          <td className="py-2.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-red-500 hover:text-red-700 p-1 rounded-lg"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Retenciones y Resumen de Totales */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start pt-2">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                    Retenciones en la Fuente aplicables
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        Ret. Renta IR ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={purchaseForm.retencion_renta}
                        onChange={(e) => setPurchaseForm({ ...purchaseForm, retencion_renta: e.target.value })}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        Ret. IVA ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={purchaseForm.retencion_iva}
                        onChange={(e) => setPurchaseForm({ ...purchaseForm, retencion_iva: e.target.value })}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 pt-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Observaciones</label>
                    <input
                      type="text"
                      placeholder="Notas internas de la orden de compra..."
                      value={purchaseForm.observaciones}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, observaciones: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 space-y-2 text-sm font-medium">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Subtotal Tarifa 15%:</span>
                    <span className="font-mono">${purchaseCalculations.subtotal15.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Subtotal Tarifa 0%:</span>
                    <span className="font-mono">${purchaseCalculations.subtotal0.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Crédito Tributario IVA (15%):</span>
                    <span className="font-mono text-emerald-600 font-bold">${purchaseCalculations.iva.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-indigo-200 dark:border-indigo-800">
                    <span className="font-bold">Total Factura Proveedor:</span>
                    <span className="font-mono font-bold">${purchaseCalculations.totalFactura.toFixed(2)}</span>
                  </div>

                  {(parseFloat(purchaseForm.retencion_renta) > 0 || parseFloat(purchaseForm.retencion_iva) > 0) && (
                    <div className="flex justify-between text-xs text-red-600 dark:text-red-400 pt-1">
                      <span>Menos Retenciones:</span>
                      <span className="font-mono">
                        -${(
                          (parseFloat(purchaseForm.retencion_renta) || 0) +
                          (parseFloat(purchaseForm.retencion_iva) || 0)
                        ).toFixed(2)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-lg font-black text-indigo-700 dark:text-indigo-300 pt-2 border-t border-indigo-200 dark:border-indigo-800">
                    <span>Total a Pagar:</span>
                    <span className="font-mono">${purchaseCalculations.totalPagar.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setNewPurchaseModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPurchase || purchaseForm.items.length === 0}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md disabled:opacity-50 transition active:scale-95 flex items-center gap-2"
                >
                  {savingPurchase ? "Registrando & Generando Asiento..." : "Guardar Compra"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: VER DETALLE DE COMPRA */}
      {/* ========================================================= */}
      {selectedPurchase && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-xs uppercase font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  Comprobante de Compra #{selectedPurchase.id}
                </span>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Factura {selectedPurchase.numero_factura}
                </h2>
              </div>
              <button
                onClick={() => setSelectedPurchase(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cabecera Info */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-slate-400 block font-bold">Proveedor:</span>
                <span className="font-bold text-slate-900 dark:text-white block">{selectedPurchase.proveedor_nombre}</span>
                <span className="font-mono text-slate-500 block">RUC: {selectedPurchase.proveedor_ruc}</span>
              </div>
              <div className="space-y-1 text-right">
                <span className="text-slate-400 block font-bold">Fecha de Emisión:</span>
                <span className="font-mono font-bold">{selectedPurchase.fecha_emision}</span>
                <span className="text-slate-500 block capitalize">Pago: {selectedPurchase.metodo_pago}</span>
              </div>
            </div>

            {/* Asiento Contable Banner */}
            {selectedPurchase.asiento_numero && (
              <div className="p-3 bg-purple-50 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-900 text-xs text-purple-900 dark:text-purple-300 flex items-center justify-between">
                <span className="flex items-center gap-2 font-bold">
                  <BookOpen className="w-4 h-4 text-purple-600" />
                  Asiento Contable Vinculado: #{selectedPurchase.asiento_numero} (Libro Diario)
                </span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-purple-200 dark:bg-purple-900">
                  Mayorizado
                </span>
              </div>
            )}

            {/* Tabla de Productos del Detalle */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold uppercase text-[10px] text-slate-500">
                  <tr>
                    <th className="py-2.5 px-3">Producto</th>
                    <th className="py-2.5 px-3 text-center">Cant.</th>
                    <th className="py-2.5 px-3 text-right">Costo</th>
                    <th className="py-2.5 px-3 text-right">IVA</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedPurchase.detalles?.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 font-medium">{d.nombre_producto}</td>
                      <td className="py-2 px-3 text-center font-mono font-bold">{d.cantidad}</td>
                      <td className="py-2 px-3 text-right font-mono">${Number(d.costo_unitario).toFixed(4)}</td>
                      <td className="py-2 px-3 text-right font-mono">${Number(d.valor_iva).toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">${Number(d.total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Resumen Final */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="text-slate-500">Registrado por: {selectedPurchase.usuario_nombre}</div>
              <div className="text-right space-y-0.5">
                <div>Total Facturado: <strong className="font-mono">${Number(selectedPurchase.total).toFixed(2)}</strong></div>
                <div className="text-base font-black text-indigo-600 dark:text-indigo-400">
                  Total Pagado: <span className="font-mono">${Number(selectedPurchase.total_pagar).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ANULAR COMPRA (REVERSIÓN CONTABLE E INVENTARIO) */}
      {/* ========================================================= */}
      {voidModalPurchase && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-red-200 dark:border-red-900 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 bg-red-100 dark:bg-red-950 rounded-2xl">
                <Ban className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Anular Factura de Compra</h2>
                <p className="text-xs text-slate-500">Acción estricta de partida doble inmutable.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Al anular la Factura <strong>{voidModalPurchase.numero_factura}</strong>:
              <br />• Se <strong>restará el stock</strong> que ingresó al inventario.
              <br />• Se creará automáticamente un <strong>Asiento de Reversión</strong> en el Libro Diario para saldar la cuenta por pagar y el inventario sin borrar el registro histórico.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Motivo de anulación:</label>
              <input
                type="text"
                placeholder="Ej. Error en cantidad facturada por proveedor..."
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setVoidModalPurchase(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={voiding}
                onClick={handleConfirmVoid}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md transition disabled:opacity-50"
              >
                {voiding ? "Anulando..." : "Confirmar Anulación"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CREAR / EDITAR PROVEEDOR */}
      {/* ========================================================= */}
      {supplierModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 font-bold text-lg">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <span>{supplierForm.id > 0 ? "Editar Proveedor" : "Nuevo Proveedor"}</span>
              </div>
              <button
                onClick={() => setSupplierModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    RUC / Cédula <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={13}
                    placeholder="1790012345001"
                    value={supplierForm.ruc}
                    onChange={(e) => setSupplierForm({ ...supplierForm, ruc: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Razón Social <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nombre legal de la empresa"
                    value={supplierForm.razon_social}
                    onChange={(e) => setSupplierForm({ ...supplierForm, razon_social: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nombre Comercial</label>
                  <input
                    type="text"
                    placeholder="Marca comercial o fantasía"
                    value={supplierForm.nombre_comercial}
                    onChange={(e) => setSupplierForm({ ...supplierForm, nombre_comercial: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Teléfono / Celular</label>
                  <input
                    type="text"
                    placeholder="0991234567"
                    value={supplierForm.telefono}
                    onChange={(e) => setSupplierForm({ ...supplierForm, telefono: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Correo Electrónico</label>
                <input
                  type="email"
                  placeholder="facturas@proveedor.com"
                  value={supplierForm.email}
                  onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Dirección</label>
                <input
                  type="text"
                  placeholder="Ciudad, Calle Principal y Secundaria"
                  value={supplierForm.direccion}
                  onChange={(e) => setSupplierForm({ ...supplierForm, direccion: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Cuenta Contable Pasivo (Plan NIIF)
                </label>
                <select
                  value={supplierForm.cuenta_por_pagar_id}
                  onChange={(e) => setSupplierForm({ ...supplierForm, cuenta_por_pagar_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono focus:outline-none"
                >
                  <option value="">Por defecto: 2.1.01.01 Proveedores Locales</option>
                  {accounts
                    .filter((a) => a.tipo === "PASIVO")
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.codigo} - {a.nombre}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSupplierModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingSupplier}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition disabled:opacity-50"
                >
                  {savingSupplier ? "Guardando..." : "Guardar Proveedor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
