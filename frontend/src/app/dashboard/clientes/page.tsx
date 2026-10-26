"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  UserPlus,
  Wallet,
  PlusCircle,
  Search,
  X,
  ShoppingBag,
  Download,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
} from "lucide-react";

interface Customer {
  id: number;
  documento: string | null;
  nombre: string;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  saldo_pendiente: string | number;
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

export default function ClientesFiadosPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [soloFiados, setSoloFiados] = useState(false);

  // Modal para Crear / Editar Cliente (con campo de dirección incluido)
  const [modalCliente, setModalCliente] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formCli, setFormCli] = useState({
    documento: "",
    nombre: "",
    email: "",
    telefono: "",
    direccion: "",
  });

  // Modal de Historial de Compras y Facturas al presionar sobre un cliente
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [customerPurchases, setCustomerPurchases] = useState<Purchase[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Modal para Abonar o Fiar
  const [movementCustomer, setMovementCustomer] = useState<Customer | null>(null);
  const [tipoMov, setTipoMov] = useState<"abono" | "cargo">("abono");
  const [montoMov, setMontoMov] = useState("");
  const [notasMov, setNotasMov] = useState("");

  const loadCustomers = async () => {
    const query = searchQuery.trim();
    const endpoint = `/tenant/customers.php?fiados=${soloFiados ? "1" : "0"}${
      query ? `&q=${encodeURIComponent(query)}` : ""
    }`;
    try {
      const res = await apiFetch<{ customers: Customer[] }>(endpoint);
      setCustomers(res.customers || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, soloFiados]);

  const totalPorCobrar = customers.reduce(
    (acc, c) => acc + Number(c.saldo_pendiente || 0),
    0
  );

  const openCreateModal = () => {
    setEditingCustomer(null);
    setFormCli({ documento: "", nombre: "", email: "", telefono: "", direccion: "" });
    setModalCliente(true);
  };

  const openEditModal = (c: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCustomer(c);
    setFormCli({
      documento: c.documento || "",
      nombre: c.nombre || "",
      email: c.email || "",
      telefono: c.telefono || "",
      direccion: c.direccion || "",
    });
    setModalCliente(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("/tenant/customers.php", {
        method: "POST",
        body: JSON.stringify({
          ...(editingCustomer ? { id: editingCustomer.id } : {}),
          ...formCli,
        }),
      });
      setModalCliente(false);
      setFormCli({ documento: "", nombre: "", email: "", telefono: "", direccion: "" });
      loadCustomers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Abrir Historial de Compras al hacer clic sobre el cliente
  const handleOpenCustomerHistory = async (c: Customer) => {
    setHistoryCustomer(c);
    setLoadingHistory(true);
    try {
      const res = await apiFetch<{ compras: Purchase[] }>(
        `/tenant/customer-history.php?cliente_id=${c.id}`
      );
      setCustomerPurchases(res.compras || []);
    } catch {
      setCustomerPurchases([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementCustomer) return;
    try {
      await apiFetch("/tenant/customer-payments.php", {
        method: "POST",
        body: JSON.stringify({
          cliente_id: movementCustomer.id,
          tipo: tipoMov,
          monto: parseFloat(montoMov),
          notas: notasMov,
        }),
      });
      setMovementCustomer(null);
      setMontoMov("");
      setNotasMov("");
      loadCustomers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const downloadPdf = (base64Data: string, filename: string) => {
    const link = document.createElement("a");
    link.href = `data:application/pdf;base64,${base64Data}`;
    link.download = `${filename}.pdf`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Encabezado y Resumen de Deudas */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Clientes & Crédito Directo</h1>
          <p className="text-sm text-slate-500">
            Busca por cédula o RUC, revisa el historial de compras y descarga facturas en PDF.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm font-semibold">
            Total en Crédito Directo: <strong>${totalPorCobrar.toFixed(2)}</strong>
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-md transition"
          >
            <UserPlus className="w-4 h-4" /> Nuevo Cliente
          </button>
        </div>
      </div>

      {/* Barra de Búsqueda por Cédula, RUC o Nombre */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Buscar cliente por Cédula, RUC o Nombre..."
            className="w-full bg-transparent outline-none text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadCustomers()}
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                loadCustomers();
              }}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={loadCustomers}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
          >
            Buscar
          </button>
        </div>

        <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={soloFiados}
            onChange={(e) => setSoloFiados(e.target.checked)}
            className="rounded text-indigo-600"
          />
          Mostrar solo clientes con saldo en Crédito Directo
        </label>
      </div>

      {/* Lista / Directorio de Clientes con Clic para ver Historial */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-500">
          Directorio de Clientes (Haz clic sobre un cliente para ver su historial de compras y facturas)
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {customers.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-400">
              No se encontraron clientes con ese criterio.
            </div>
          ) : (
            customers.map((c) => {
              const deuda = Number(c.saldo_pendiente || 0);
              return (
                <div
                  key={c.id}
                  onClick={() => handleOpenCustomerHistory(c)}
                  className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer flex flex-wrap items-center justify-between gap-3 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 flex items-center justify-center font-bold text-sm">
                      {c.nombre[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <span>{c.nombre}</span>
                        {c.documento && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            ID: {c.documento}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        {c.telefono && <span>Tel: {c.telefono}</span>}
                        {c.email && <span>Email: {c.email}</span>}
                        {c.direccion && <span>Dir: {c.direccion}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Acciones y Saldo */}
                  <div className="flex items-center gap-2.5" onClick={(e) => e.stopPropagation()}>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                        deuda > 0
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      }`}
                    >
                      {deuda > 0 ? `Crédito: $${deuda.toFixed(2)}` : "Al día ($0.00)"}
                    </span>

                    <button
                      onClick={() => {
                        setMovementCustomer(c);
                        setTipoMov("abono");
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
                      title="Registrar abono de deuda"
                    >
                      <Wallet className="w-3.5 h-3.5" /> Abonar
                    </button>

                    <button
                      onClick={() => {
                        setMovementCustomer(c);
                        setTipoMov("cargo");
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition"
                      title="Anotar nuevo Crédito Directo manual"
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> Dar Crédito
                    </button>

                    <button
                      onClick={(e) => openEditModal(c, e)}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold"
                    >
                      Editar
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL: HISTORIAL DE COMPRAS DEL CLIENTE Y DESCARGA DE FACTURA EN PDF */}
      {historyCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full p-6 border border-slate-200 dark:border-slate-800 space-y-4 max-h-[85vh] flex flex-col shadow-2xl">
            {/* Cabecera */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base">
                      {historyCustomer.nombre}
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        const c = historyCustomer;
                        setHistoryCustomer(null);
                        setEditingCustomer(c);
                        setFormCli({
                          documento: c.documento || "",
                          nombre: c.nombre || "",
                          email: c.email || "",
                          telefono: c.telefono || "",
                          direccion: c.direccion || "",
                        });
                        setModalCliente(true);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-600 hover:text-white transition"
                    >
                      Editar Datos
                    </button>
                  </div>
                  <div className="text-xs text-slate-500">
                    Cédula/RUC: {historyCustomer.documento || "S/N"} • Saldo Crédito:{" "}
                    <strong className="text-rose-600">
                      ${Number(historyCustomer.saldo_pendiente).toFixed(2)}
                    </strong>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setHistoryCustomer(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Listado de compras */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {loadingHistory ? (
                <div className="py-12 text-center text-sm text-slate-400">
                  Cargando compras y facturas del cliente...
                </div>
              ) : customerPurchases.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">
                  Este cliente aún no tiene compras registradas en el sistema.
                </div>
              ) : (
                customerPurchases.map((compra) => (
                  <div
                    key={compra.venta_id}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">Venta #{compra.venta_id}</span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" /> {compra.fecha}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                            compra.metodo_pago === "fiado"
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                              : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                          }`}
                        >
                          {compra.metodo_pago === "fiado" ? "Crédito Directo" : compra.metodo_pago}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">
                          ${compra.total.toFixed(2)}
                        </span>
                        {compra.pdf_base64 && (
                          <button
                            onClick={() =>
                              downloadPdf(
                                compra.pdf_base64!,
                                compra.numero_comprobante || `Factura_${compra.venta_id}`
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm"
                            title="Descargar factura en PDF"
                          >
                            <Download className="w-3.5 h-3.5" /> Descargar PDF
                          </button>
                        )}
                      </div>
                    </div>

                    {compra.numero_comprobante && (
                      <div className="text-xs text-slate-500 font-medium">
                        Factura Electrónica: <strong>{compra.numero_comprobante}</strong>
                      </div>
                    )}

                    {/* Detalle de productos comprados */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 text-xs divide-y divide-slate-100 dark:divide-slate-800">
                      {compra.detalles.map((det, idx) => (
                        <div key={idx} className="py-1 flex justify-between items-center">
                          <span>
                            {det.cantidad}x {det.nombre_producto}
                          </span>
                          <span className="font-semibold">${Number(det.subtotal).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setHistoryCustomer(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREAR / EDITAR CLIENTE (CON CAMPO DIRECCIÓN INCLUIDO) */}
      {modalCliente && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveCustomer}
            className="bg-white dark:bg-slate-900 p-6 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 space-y-3.5 text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <h3 className="font-extrabold text-sm">
                {editingCustomer ? `Editar Cliente: ${editingCustomer.nombre}` : "Registrar Nuevo Cliente"}
              </h3>
              <button type="button" onClick={() => setModalCliente(false)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block font-semibold mb-1">Nombre Completo / Razón Social *</label>
              <input
                type="text"
                required
                placeholder="Ej. Distribuidora Gómez"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm font-semibold"
                value={formCli.nombre}
                onChange={(e) => setFormCli({ ...formCli, nombre: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Cédula / RUC / NIT</label>
                <input
                  type="text"
                  placeholder="0999999999"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent"
                  value={formCli.documento}
                  onChange={(e) => setFormCli({ ...formCli, documento: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Teléfono / WhatsApp</label>
                <input
                  type="text"
                  placeholder="099887766"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent"
                  value={formCli.telefono}
                  onChange={(e) => setFormCli({ ...formCli, telefono: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1">Correo Electrónico (para Factura)</label>
              <input
                type="email"
                placeholder="cliente@correo.com"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent"
                value={formCli.email}
                onChange={(e) => setFormCli({ ...formCli, email: e.target.value })}
              />
            </div>

            {/* CAMPO DE DIRECCIÓN */}
            <div>
              <label className="block font-semibold mb-1">Dirección Domiciliaria / Local</label>
              <input
                type="text"
                placeholder="Av. 10 de Agosto #456 y Colón"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent"
                value={formCli.direccion}
                onChange={(e) => setFormCli({ ...formCli, direccion: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setModalCliente(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition"
              >
                {editingCustomer ? "Guardar Cambios" : "Crear Cliente"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: ABONAR O FIAR */}
      {movementCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleMovement}
            className="bg-white dark:bg-slate-900 p-6 rounded-3xl max-w-sm w-full border border-slate-200 dark:border-slate-800 space-y-3.5 text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <h3 className="font-extrabold text-sm">
                {tipoMov === "abono" ? "Registrar Abono" : "Anotar Crédito Directo"} • {movementCustomer.nombre}
              </h3>
              <button type="button" onClick={() => setMovementCustomer(null)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Saldo pendiente actual:{" "}
              <strong className="text-rose-600">${Number(movementCustomer.saldo_pendiente).toFixed(2)}</strong>
            </p>

            <input
              type="number"
              step="0.01"
              required
              placeholder="Monto ($)"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-lg font-extrabold outline-none focus:ring-2 focus:ring-indigo-500"
              value={montoMov}
              onChange={(e) => setMontoMov(e.target.value)}
            />

            <input
              type="text"
              placeholder="Nota o referencia de pago (opcional)"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent"
              value={notasMov}
              onChange={(e) => setNotasMov(e.target.value)}
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setMovementCustomer(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={`px-5 py-2 rounded-xl font-bold text-white transition ${
                  tipoMov === "abono" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-500 hover:bg-amber-600"
                }`}
              >
                Confirmar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
