"use client";

import { useMemo, useState, useEffect } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  ShoppingBag,
  Plus,
  Minus,
  CreditCard,
  Upload,
  CheckCircle2,
  MapPin,
  Phone,
  Search,
  X,
  Folder,
  Layers,
  MessageCircle,
} from "lucide-react";


const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost/pymeweb/backend-api/api";

interface StoreInfo {
  id: number;
  nombre: string;
  slug: string;
  telefono: string | null;
  direccion: string | null;
  logo_url: string | null;
}

interface Category {
  id: number;
  nombre: string;
  descripcion: string | null;
}

interface Product {
  id: number;
  categoria_id?: number | null;
  categoria_nombre?: string | null;
  nombre: string;
  descripcion: string | null;
  precio_venta: number | string;
  stock: number;
  imagen_url: string | null;
}

export default function StorefrontClient({
  store,
  initialProducts,
  initialCategories = [],
}: {
  store: StoreInfo;
  initialProducts: Product[];
  initialCategories?: Category[];
}) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [selectedCategory, setSelectedCategory] = useState<number | "all">("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<{ product: Product; cantidad: number }[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // Leer productos pre-cargados desde enlace generado por el Asistente de WhatsApp (?cart=... o ?add=1&qty=1)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const cartParam = params.get("cart");
    const addParam = params.get("add");

    if (cartParam) {
      try {
        const decoded = JSON.parse(atob(cartParam));
        if (Array.isArray(decoded)) {
          const newCartItems: { product: Product; cantidad: number }[] = [];
          decoded.forEach((item: { id: number; qty?: number }) => {
            const prod = initialProducts.find((p) => p.id === Number(item.id));
            if (prod && prod.stock > 0) {
              const qty = Math.min(Math.max(1, item.qty || 1), prod.stock);
              newCartItems.push({ product: prod, cantidad: qty });
            }
          });
          if (newCartItems.length > 0) {
            setCart(newCartItems);
            setCheckoutOpen(true); // Abrir directamente el carrito para checkout rápido
          }
        }
      } catch (e) {
        console.error("Error al decodificar parámetro cart:", e);
      }
    } else if (addParam) {
      const prodId = Number(addParam);
      const qtyParam = Number(params.get("qty") || 1);
      const prod = initialProducts.find((p) => p.id === prodId);
      if (prod && prod.stock > 0) {
        setCart([{ product: prod, cantidad: Math.min(qtyParam, prod.stock) }]);
        setCheckoutOpen(true);
      }
    }
  }, [initialProducts]);

  const [modalidadPago, setModalidadPago] = useState<"online" | "transferencia">("transferencia");
  const [voucherFile, setVoucherFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<{
    pedido_id: number;
    total: number;
    store_telefono?: string;
  } | null>(null);

  const [buyer, setBuyer] = useState({
    nombre: "",
    telefono: "",
    email: "",
    direccion: "",
    referencia_pago: "",
  });

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const found = prev.find((i) => i.product.id === product.id);
      if (found) {
        if (found.cantidad >= product.stock) return prev;
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, cantidad: i.cantidad + 1 } : i
        );
      }
      return [...prev, { product, cantidad: 1 }];
    });
  };

  const changeQty = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id !== productId) return item;
          const next = item.cantidad + delta;
          if (next > item.product.stock) return item;
          return { ...item, cantidad: next };
        })
        .filter((item) => item.cantidad > 0)
    );
  };

  const total = useMemo(
    () =>
      cart.reduce(
        (acc, item) => acc + Number(item.product.precio_venta) * item.cantidad,
        0
      ),
    [cart]
  );

  const groupedCategories = useMemo(() => {
    const term = search.trim().toLowerCase();
    const activeProducts = term
      ? products.filter(
          (p) =>
            p.nombre.toLowerCase().includes(term) ||
            (p.descripcion && p.descripcion.toLowerCase().includes(term))
        )
      : products;

    const groups: {
      category: Category | null;
      items: Product[];
    }[] = [];

    // Categorías con productos
    categories.forEach((cat) => {
      if (selectedCategory === "all" || selectedCategory === cat.id) {
        const items = activeProducts.filter((p) => p.categoria_id === cat.id);
        if (items.length > 0) {
          groups.push({ category: cat, items });
        }
      }
    });

    // Productos sin categoría (si los hay)
    if (selectedCategory === "all") {
      const sinCat = activeProducts.filter((p) => !p.categoria_id);
      if (sinCat.length > 0) {
        groups.push({ category: null, items: sinCat });
      }
    }

    return groups;
  }, [products, categories, selectedCategory, search]);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    setSubmitting(true);

    const fd = new FormData();
    fd.append("slug", store.slug);
    fd.append("cliente_nombre", buyer.nombre);
    fd.append("cliente_telefono", buyer.telefono);
    fd.append("cliente_email", buyer.email);
    fd.append("direccion_entrega", buyer.direccion);
    fd.append("modalidad_pago", modalidadPago);
    fd.append("referencia_pago", buyer.referencia_pago);
    fd.append(
      "items",
      JSON.stringify(
        cart.map((i) => ({
          producto_id: i.product.id,
          cantidad: i.cantidad,
        }))
      )
    );

    if (modalidadPago === "transferencia" && voucherFile) {
      fd.append("comprobante", voucherFile);
    }

    try {
      const res = await fetch(`${API_BASE}/storefront/checkout.php`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al procesar el pedido");

      setProducts((prev) =>
        prev
          .map((p) => {
            const bought = cart.find((c) => c.product.id === p.id);
            return bought ? { ...p, stock: p.stock - bought.cantidad } : p;
          })
          .filter((p) => p.stock > 0)
      );

      setOrderSuccess({
        pedido_id: data.pedido_id,
        total: data.total,
        store_telefono: data.store_telefono,
      });
      setCart([]);
      setCheckoutOpen(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {store.logo_url ? (
              <img
                src={store.logo_url}
                alt={store.nombre}
                className="w-12 h-12 rounded-2xl object-cover border border-slate-200 dark:border-slate-700"
              />
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg">
                {store.nombre[0]}
              </div>
            )}
            <div>
              <h1 className="font-extrabold text-lg">{store.nombre}</h1>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                {store.direccion && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {store.direccion}
                  </span>
                )}
                {store.telefono && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" /> {store.telefono}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={() => setCheckoutOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Carrito ({cart.reduce((a, b) => a + b.cantidad, 0)})</span>
              <span>• ${total.toFixed(2)}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {orderSuccess && (
          <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 space-y-3">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-lg">
              <CheckCircle2 className="w-6 h-6" />
              <span>¡Pedido #{orderSuccess.pedido_id} confirmado!</span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Hemos descontado tus productos del stock y notificado a{" "}
              <strong>{store.nombre}</strong>. Total: <strong>${orderSuccess.total.toFixed(2)}</strong>
            </p>
            {orderSuccess.store_telefono && (
              <a
                href={`https://wa.me/${orderSuccess.store_telefono.replace(
                  /\D/g,
                  ""
                )}?text=${encodeURIComponent(
                  `Hola ${store.nombre}, acabo de realizar el Pedido Web #${orderSuccess.pedido_id} por $${orderSuccess.total.toFixed(2)}.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="inline-block px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
              >
                Enviar confirmación por WhatsApp
              </a>
            )}
          </div>
        )}

        {/* Barra de Búsqueda y Filtros de Categorías */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md shadow-sm">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Buscar productos en la tienda..."
              className="w-full bg-transparent outline-none text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {categories.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedCategory("all")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 ${
                  selectedCategory === "all"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Todos ({products.length})
              </button>
              {categories.map((c) => {
                const count = products.filter((p) => p.categoria_id === c.id).length;
                if (count === 0) return null;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCategory(c.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 ${
                      selectedCategory === c.id
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                        : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <Folder className="w-3.5 h-3.5" />
                    {c.nombre} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Listado de Productos Agrupados por Categoría */}
        {groupedCategories.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
            No se encontraron productos disponibles que coincidan con la búsqueda.
          </div>
        ) : (
          <div className="space-y-10">
            {groupedCategories.map((group, idx) => {
              const catName = group.category ? group.category.nombre : "Otros Productos";
              const catDesc = group.category?.descripcion;

              return (
                <section
                  key={group.category ? group.category.id : `cat-none-${idx}`}
                  className="space-y-4"
                >
                  {/* Encabezado de la Categoría */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                        <Folder className="w-4 h-4" />
                      </div>
                      <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                        {catName}
                      </h2>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                        {group.items.length} {group.items.length === 1 ? "producto" : "productos"}
                      </span>
                    </div>
                    {catDesc && (
                      <p className="text-xs text-slate-400 max-w-md">{catDesc}</p>
                    )}
                  </div>

                  {/* Cuadrícula de Productos de esta Categoría */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                    {group.items.map((p) => (
                      <div
                        key={p.id}
                        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md transition"
                      >
                        <div>
                          {p.imagen_url ? (
                            <img
                              src={p.imagen_url}
                              alt={p.nombre}
                              className="w-full h-44 object-cover"
                            />
                          ) : (
                            <div className="w-full h-44 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs text-slate-400">
                              Sin imagen
                            </div>
                          )}
                          <div className="p-4 space-y-1">
                            <h3 className="font-bold text-base">{p.nombre}</h3>
                            {p.descripcion && (
                              <p className="text-xs text-slate-500 line-clamp-2">
                                {p.descripcion}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="p-4 pt-0 flex items-center justify-between">
                          <div>
                            <div className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400">
                              ${Number(p.precio_venta).toFixed(2)}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {p.stock} disponibles
                            </div>
                          </div>
                          <button
                            onClick={() => addToCart(p)}
                            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1 shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5" /> Agregar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      {checkoutOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 space-y-4 my-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Finalizar Pedido</h2>
              <button onClick={() => setCheckoutOpen(false)} className="font-bold">
                ✕
              </button>
            </div>

            {cart.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                Tu carrito está vacío.
              </p>
            ) : (
              <>
                <div className="max-h-44 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="py-2 flex items-center justify-between gap-2"
                    >
                      <span className="font-medium truncate flex-1">{item.product.nombre}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => changeQty(item.product.id, -1)}
                          className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-bold text-xs">{item.cantidad}</span>
                        <button
                          type="button"
                          onClick={() => changeQty(item.product.id, 1)}
                          className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="font-bold w-16 text-right">
                        ${(Number(item.product.precio_venta) * item.cantidad).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleCheckout} className="space-y-3 text-sm pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Tu Nombre Completo"
                      className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                      value={buyer.nombre}
                      onChange={(e) => setBuyer({ ...buyer, nombre: e.target.value })}
                    />
                    <input
                      type="tel"
                      required
                      placeholder="Tu WhatsApp / Teléfono"
                      className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                      value={buyer.telefono}
                      onChange={(e) => setBuyer({ ...buyer, telefono: e.target.value })}
                    />
                  </div>

                  <input
                    type="text"
                    required
                    placeholder="Dirección de entrega o referencia"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                    value={buyer.direccion}
                    onChange={(e) => setBuyer({ ...buyer, direccion: e.target.value })}
                  />

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setModalidadPago("transferencia")}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                        modalidadPago === "transferencia"
                          ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300"
                          : "border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <Upload className="w-4 h-4" /> Transferencia / Voucher
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalidadPago("online")}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                        modalidadPago === "online"
                          ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300"
                          : "border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <CreditCard className="w-4 h-4" /> Pago Online
                    </button>
                  </div>

                  {modalidadPago === "transferencia" ? (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-2 text-xs">
                      <p className="text-slate-500">
                        Adjunta la captura de tu transferencia bancaria o billetera móvil:
                      </p>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        required
                        onChange={(e) => setVoucherFile(e.target.files?.[0] || null)}
                      />
                      <input
                        type="text"
                        placeholder="N° de operación (opcional)"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                        value={buyer.referencia_pago}
                        onChange={(e) =>
                          setBuyer({ ...buyer, referencia_pago: e.target.value })
                        }
                      />
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-2 text-xs">
                      <input
                        type="text"
                        required
                        placeholder="Referencia / Token de Pago Online"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                        value={buyer.referencia_pago}
                        onChange={(e) =>
                          setBuyer({ ...buyer, referencia_pago: e.target.value })
                        }
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 font-extrabold text-lg">
                    <span>Total a Pagar:</span>
                    <span className="text-indigo-600 dark:text-indigo-400">
                      ${total.toFixed(2)}
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  >
                    {submitting ? "Procesando pedido..." : "Confirmar Pedido"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Botón flotante de WhatsApp para consultar con la IA o el negocio */}
      {store.telefono && (
        <a
          href={`https://wa.me/${store.telefono.replace(/\D+/g, "")}?text=${encodeURIComponent(
            `¡Hola! Estoy visitando la tienda ${store.nombre}. ¿Tienen disponibilidad de algún producto?`
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-40 bg-emerald-500 hover:bg-emerald-600 text-white p-3.5 rounded-full shadow-2xl flex items-center gap-2 group transition-all duration-300 hover:scale-105"
          title="Consultar por WhatsApp (IA)"
        >
          <MessageCircle className="w-6 h-6" />
          <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 text-xs font-bold pr-1">
            Consultar por WhatsApp
          </span>
        </a>
      )}
    </div>
  );
}


