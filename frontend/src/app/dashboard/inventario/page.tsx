"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import CameraPhotoCapture from "@/components/CameraPhotoCapture";
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Image as ImageIcon,
  Camera,
  Upload,
  X,
  CheckCircle2,
  Tags,
  FolderPlus,
  Folder,
  Layers,
  LayoutGrid,
  List,
  BookOpen,
} from "lucide-react";

interface Category {
  id: number;
  nombre: string;
  descripcion: string | null;
  cuenta_inventario_id?: number | null;
  cuenta_ingreso_id?: number | null;
  cuenta_costo_id?: number | null;
  total_productos: number;
}

interface Product {
  id: number;
  categoria_id: number | null;
  categoria_nombre: string | null;
  codigo_barra: string | null;
  nombre: string;
  descripcion: string | null;
  precio_compra: string | number;
  precio_venta: string | number;
  cuenta_inventario_id?: number | null;
  cuenta_ingreso_id?: number | null;
  cuenta_costo_id?: number | null;
  sri_codigo_impuesto?: string;
  sri_tarifa_iva?: string | number;
  stock: number;
  stock_minimo?: number;
  proveedor_id?: number | null;
  proveedor_nombre?: string | null;
  imagen_url: string | null;
  bajo_stock?: number;
}

interface Supplier {
  id: number;
  razon_social: string;
  ruc: string;
}

interface Account {
  id: number;
  codigo: string;
  nombre: string;
  tipo: string;
}

export default function InventarioPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [q, setQ] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | "all" | "none" | "low_stock">("all");
  const [viewMode, setViewMode] = useState<"grouped" | "table">("grouped");

  // Modal Producto
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [showLiveCamera, setShowLiveCamera] = useState(false);
  const [showAccountingMapping, setShowAccountingMapping] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState({
    categoria_id: "",
    codigo_barra: "",
    nombre: "",
    descripcion: "",
    precio_compra: "",
    precio_venta: "",
    sri_codigo_impuesto: "4",
    stock: "0",
    stock_minimo: "5",
    proveedor_id: "",
    cuenta_inventario_id: "",
    cuenta_ingreso_id: "",
    cuenta_costo_id: "",
  });

  // Modal Categorías
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catForm, setCatForm] = useState({
    id: 0,
    nombre: "",
    descripcion: "",
    cuenta_inventario_id: "",
    cuenta_ingreso_id: "",
    cuenta_costo_id: "",
  });
  const [savingCategory, setSavingCategory] = useState(false);

  const loadCategories = async () => {
    try {
      const res = await apiFetch<{ categories: Category[] }>("/tenant/categories.php");
      setCategories(res.categories || []);
    } catch (e) {
      console.error("Error al cargar categorías:", e);
    }
  };

  const loadSuppliersAndAccounts = async () => {
    try {
      const [resSuppliers, resAccounts] = await Promise.all([
        apiFetch<{ suppliers: Supplier[] }>("/tenant/suppliers.php").catch(() => ({ suppliers: [] })),
        apiFetch<{ accounts: Account[] }>("/tenant/accounting/accounts.php?movimiento=1").catch(() => ({ accounts: [] })),
      ]);
      setSuppliers(resSuppliers.suppliers || []);
      setAccounts(resAccounts.accounts || []);
    } catch (e) {
      console.error("Error al cargar proveedores o cuentas:", e);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await apiFetch<{ products: Product[] }>(
        `/tenant/products.php?q=${encodeURIComponent(q)}`
      );
      setProducts(res.products || []);
    } catch (e) {
      console.error("Error al cargar productos:", e);
    }
  };

  useEffect(() => {
    loadProducts();
    loadCategories();
    loadSuppliersAndAccounts();
  }, []);

  const handleImageSelected = (file: File | null) => {
    if (!file) return;
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreviewUrl(url);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreviewUrl(null);
  };

  const openNew = (defaultCatId?: number) => {
    setEditing(null);
    setImageFile(null);
    setImagePreviewUrl(null);
    setShowAccountingMapping(false);
    setForm({
      categoria_id: defaultCatId
        ? String(defaultCatId)
        : selectedCategory !== "all" && selectedCategory !== "none" && selectedCategory !== "low_stock"
        ? String(selectedCategory)
        : "",
      codigo_barra: "",
      nombre: "",
      descripcion: "",
      precio_compra: "",
      precio_venta: "",
      sri_codigo_impuesto: "4", // 4 = 15% IVA vigente SRI
      stock: "10",
      stock_minimo: "5",
      proveedor_id: "",
      cuenta_inventario_id: "",
      cuenta_ingreso_id: "",
      cuenta_costo_id: "",
    });
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setImageFile(null);
    setImagePreviewUrl(p.imagen_url || null);
    setShowAccountingMapping(Boolean(p.cuenta_inventario_id || p.cuenta_ingreso_id || p.cuenta_costo_id));
    setForm({
      categoria_id: p.categoria_id ? String(p.categoria_id) : "",
      codigo_barra: p.codigo_barra || "",
      nombre: p.nombre,
      descripcion: p.descripcion || "",
      precio_compra: String(p.precio_compra),
      precio_venta: String(p.precio_venta),
      sri_codigo_impuesto: p.sri_codigo_impuesto || "4",
      stock: String(p.stock),
      stock_minimo: String(p.stock_minimo ?? 5),
      proveedor_id: p.proveedor_id ? String(p.proveedor_id) : "",
      cuenta_inventario_id: p.cuenta_inventario_id ? String(p.cuenta_inventario_id) : "",
      cuenta_ingreso_id: p.cuenta_ingreso_id ? String(p.cuenta_ingreso_id) : "",
      cuenta_costo_id: p.cuenta_costo_id ? String(p.cuenta_costo_id) : "",
    });
    setModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    if (editing) fd.append("id", String(editing.id));
    if (form.categoria_id) fd.append("categoria_id", form.categoria_id);
    fd.append("codigo_barra", form.codigo_barra);
    fd.append("nombre", form.nombre);
    fd.append("descripcion", form.descripcion);
    fd.append("precio_compra", form.precio_compra || "0");
    fd.append("precio_venta", form.precio_venta);
    fd.append("sri_codigo_impuesto", form.sri_codigo_impuesto || "4");
    fd.append("stock", form.stock);
    fd.append("stock_minimo", form.stock_minimo || "5");
    if (form.proveedor_id) fd.append("proveedor_id", form.proveedor_id);
    if (form.cuenta_inventario_id) fd.append("cuenta_inventario_id", form.cuenta_inventario_id);
    if (form.cuenta_ingreso_id) fd.append("cuenta_ingreso_id", form.cuenta_ingreso_id);
    if (form.cuenta_costo_id) fd.append("cuenta_costo_id", form.cuenta_costo_id);
    if (imageFile) fd.append("imagen", imageFile);

    try {
      await apiFetch("/tenant/products.php", { method: "POST", body: fd });
      setModalOpen(false);
      await Promise.all([loadProducts(), loadCategories()]);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!window.confirm("¿Eliminar este producto del inventario?")) return;
    await apiFetch(`/tenant/products.php?id=${id}`, { method: "DELETE" });
    await Promise.all([loadProducts(), loadCategories()]);
  };

  // Manejo de Categorías
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catForm.nombre.trim()) return;
    setSavingCategory(true);
    try {
      await apiFetch("/tenant/categories.php", {
        method: "POST",
        body: JSON.stringify({
          id: catForm.id || undefined,
          nombre: catForm.nombre.trim(),
          descripcion: catForm.descripcion.trim(),
          cuenta_inventario_id: catForm.cuenta_inventario_id ? Number(catForm.cuenta_inventario_id) : null,
          cuenta_ingreso_id: catForm.cuenta_ingreso_id ? Number(catForm.cuenta_ingreso_id) : null,
          cuenta_costo_id: catForm.cuenta_costo_id ? Number(catForm.cuenta_costo_id) : null,
        }),
      });
      setCatForm({
        id: 0,
        nombre: "",
        descripcion: "",
        cuenta_inventario_id: "",
        cuenta_ingreso_id: "",
        cuenta_costo_id: "",
      });
      await Promise.all([loadCategories(), loadProducts()]);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: number, nombre: string) => {
    if (
      !window.confirm(
        `¿Eliminar la categoría "${nombre}"? Los productos no se borrarán, solo quedarán sin categoría asignada.`
      )
    )
      return;
    try {
      await apiFetch(`/tenant/categories.php?id=${id}`, { method: "DELETE" });
      if (selectedCategory === id) setSelectedCategory("all");
      await Promise.all([loadCategories(), loadProducts()]);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const lowStockCount = useMemo(() => {
    return products.filter((p) => p.stock <= (p.stock_minimo ?? 5)).length;
  }, [products]);

  // Productos filtrados según la categoría activa y búsqueda
  const filteredProducts = useMemo(() => {
    let list = products;
    if (selectedCategory === "low_stock") {
      list = list.filter((p) => p.stock <= (p.stock_minimo ?? 5));
    } else if (selectedCategory === "none") {
      list = list.filter((p) => !p.categoria_id);
    } else if (selectedCategory !== "all") {
      list = list.filter((p) => p.categoria_id === selectedCategory);
    }
    return list;
  }, [products, selectedCategory]);

  // Agrupamiento de productos por categoría para la "Vista por Categorías"
  const groupedCategories = useMemo(() => {
    const term = q.trim().toLowerCase();
    const activeProducts = term
      ? products.filter(
          (p) =>
            p.nombre.toLowerCase().includes(term) ||
            (p.codigo_barra && p.codigo_barra.toLowerCase().includes(term))
        )
      : products;

    const groups: {
      category: Category | null;
      items: Product[];
    }[] = [];

    if (selectedCategory === "low_stock") {
      const lowItems = activeProducts.filter((p) => p.stock <= (p.stock_minimo ?? 5));
      groups.push({
        category: {
          id: -1,
          nombre: "⚠️ Productos con Stock Bajo",
          descripcion: "Existencias por debajo del umbral mínimo de reposición",
          total_productos: lowItems.length,
        },
        items: lowItems,
      });
      return groups;
    }

    // Categorías registradas
    categories.forEach((cat) => {
      if (selectedCategory === "all" || selectedCategory === cat.id) {
        const items = activeProducts.filter((p) => p.categoria_id === cat.id);
        groups.push({ category: cat, items });
      }
    });

    // Productos sin categoría
    if (selectedCategory === "all" || selectedCategory === "none") {
      const sinCat = activeProducts.filter((p) => !p.categoria_id);
      if (sinCat.length > 0 || selectedCategory === "none") {
        groups.push({ category: null, items: sinCat });
      }
    }

    return groups;
  }, [products, categories, selectedCategory, q]);

  const sinCategoriaCount = products.filter((p) => !p.categoria_id).length;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Inventario & Categorías</h1>
          <p className="text-sm text-slate-500">
            Organiza tus productos por categorías, gestiona existencias, precios y fotos.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setCatForm({
                id: 0,
                nombre: "",
                descripcion: "",
                cuenta_inventario_id: "",
                cuenta_ingreso_id: "",
                cuenta_costo_id: "",
              });
              setCatModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-sm font-semibold hover:bg-indigo-100 transition shadow-sm"
          >
            <FolderPlus className="w-4 h-4" /> Administrar Categorías
          </button>

          <button
            onClick={() => openNew()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-md transition"
          >
            <Plus className="w-4 h-4" /> Nuevo Producto
          </button>
        </div>
      </div>

      {/* Barra de Búsqueda y Switch de Vista */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex-1 min-w-[280px]">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Buscar por nombre o código de barras..."
            className="w-full bg-transparent outline-none text-sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadProducts()}
          />
          {q && (
            <button
              onClick={() => {
                setQ("");
                loadProducts();
              }}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={loadProducts}
            className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-xs font-bold"
          >
            Buscar
          </button>
        </div>

        {/* Alternador de Vista (Agrupada por Categoría vs Tabla Completa) */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setViewMode("grouped")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
              viewMode === "grouped"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Por Categorías
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
              viewMode === "table"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <List className="w-3.5 h-3.5" /> Tabla Completa
          </button>
        </div>
      </div>

      {/* PÍLDORAS INTERACTIVAS DE CATEGORÍAS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setSelectedCategory("all")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 ${
            selectedCategory === "all"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Todas ({products.length})
        </button>

        {lowStockCount > 0 && (
          <button
            onClick={() => setSelectedCategory("low_stock")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 ${
              selectedCategory === "low_stock"
                ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                : "bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
            }`}
          >
            <span>⚠️ Bajo Stock</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200">
              {lowStockCount}
            </span>
          </button>
        )}

        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCategory(c.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 ${
              selectedCategory === c.id
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            {c.nombre} ({c.total_productos})
          </button>
        ))}

        {sinCategoriaCount > 0 && (
          <button
            onClick={() => setSelectedCategory("none")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 ${
              selectedCategory === "none"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            Sin Categoría ({sinCategoriaCount})
          </button>
        )}

        <button
          onClick={() => {
            setCatForm({
              id: 0,
              nombre: "",
              descripcion: "",
              cuenta_inventario_id: "",
              cuenta_ingreso_id: "",
              cuenta_costo_id: "",
            });
            setCatModalOpen(true);
          }}
          className="px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 border border-dashed border-indigo-400 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Nueva Categoría
        </button>
      </div>

      {/* VISTA 1: AGRUPADA POR CATEGORÍAS (Categorías y todos los productos de esta categoría) */}
      {viewMode === "grouped" ? (
        <div className="space-y-6">
          {groupedCategories.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              No hay productos registrados en esta sección.
            </div>
          ) : (
            groupedCategories.map((group, idx) => {
              const catName = group.category ? group.category.nombre : "Sin Categoría";
              const catDesc = group.category?.descripcion;

              return (
                <div
                  key={group.category ? group.category.id : `group-none-${idx}`}
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm space-y-3 p-5"
                >
                  {/* Encabezado de la Categoría */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                        <Folder className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                            {catName}
                          </h2>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                            {group.items.length} productos
                          </span>
                        </div>
                        {catDesc && <p className="text-xs text-slate-400">{catDesc}</p>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openNew(group.category ? group.category.id : undefined)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-100 transition"
                      >
                        <Plus className="w-3.5 h-3.5" /> Agregar producto aquí
                      </button>
                    </div>
                  </div>

                  {/* Listado de Productos de esta Categoría */}
                  {group.items.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-4 text-center">
                      Aún no hay productos asignados a esta categoría. Haz clic en "Agregar producto aquí".
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                      {group.items.map((p) => (
                        <div
                          key={p.id}
                          className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-indigo-200 dark:hover:border-indigo-900 flex items-center justify-between gap-3 transition"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {p.imagen_url ? (
                              <img
                                src={p.imagen_url}
                                alt={p.nombre}
                                className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                                <ImageIcon className="w-5 h-5" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <h3 className="font-bold text-sm truncate text-slate-800 dark:text-slate-100">
                                {p.nombre}
                              </h3>
                              <div className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                                ${Number(p.precio_venta).toFixed(2)}
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-2">
                                <span>Stock: <strong>{p.stock}</strong></span>
                                {p.codigo_barra && <span>• SKU: {p.codigo_barra}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => openEdit(p)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                              title="Editar producto"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p.id)}
                              className="p-1.5 rounded-lg border border-red-200 dark:border-red-900/60 hover:bg-red-50 text-red-600"
                              title="Eliminar producto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* VISTA 2: TABLA COMPLETA */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs uppercase text-slate-500">
                <th className="py-3 px-4">Producto</th>
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4">Costo</th>
                <th className="py-3 px-4">Precio Venta</th>
                <th className="py-3 px-4">Stock</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                    No se encontraron productos.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 px-4 flex items-center gap-3">
                      {p.imagen_url ? (
                        <img
                          src={p.imagen_url}
                          alt={p.nombre}
                          className="w-11 h-11 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                      )}
                      <div>
                        <div className="font-semibold">{p.nombre}</div>
                        {p.codigo_barra && (
                          <div className="text-xs text-slate-400">SKU: {p.codigo_barra}</div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                        {p.categoria_nombre || "Sin Categoría"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">${Number(p.precio_compra).toFixed(2)}</td>
                    <td className="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                      ${Number(p.precio_venta).toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          p.stock <= 5
                            ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        }`}
                      >
                        {p.stock} uds
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => openEdit(p)}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(p.id)}
                        className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: NUEVO / EDITAR PRODUCTO */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveProduct}
            className="bg-white dark:bg-slate-900 p-6 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 space-y-3.5 text-sm shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <h2 className="text-lg font-bold">
                {editing ? "Editar Producto" : "Nuevo Producto"}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block font-medium mb-1">Nombre del Producto *</label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </div>

            {/* Selector de Categoría con opción de crear nueva */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-medium">Categoría</label>
                <button
                  type="button"
                  onClick={() => {
                    setCatForm({
                      id: 0,
                      nombre: "",
                      descripcion: "",
                      cuenta_inventario_id: "",
                      cuenta_ingreso_id: "",
                      cuenta_costo_id: "",
                    });
                    setCatModalOpen(true);
                  }}
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1"
                >
                  <FolderPlus className="w-3.5 h-3.5" /> + Nueva Categoría
                </button>
              </div>
              <select
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                value={form.categoria_id}
                onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}
              >
                <option value="">(Sin Categoría)</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium mb-1">Código de Barras</label>
                <input
                  type="text"
                  placeholder="Ej. 770123456"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form.codigo_barra}
                  onChange={(e) => setForm({ ...form, codigo_barra: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Stock Disponible *</label>
                <input
                  type="number"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium mb-1">Costo Compra ($)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form.precio_compra}
                  onChange={(e) => setForm({ ...form, precio_compra: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Precio Venta ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  value={form.precio_venta}
                  onChange={(e) => setForm({ ...form, precio_venta: e.target.value })}
                />
              </div>
            </div>

            {/* Impuesto Dinámico SRI */}
            <div>
              <label className="block font-medium mb-1">
                Tarifa IVA (Catálogo SRI Ecuador)
              </label>
              <select
                value={form.sri_codigo_impuesto}
                onChange={(e) => setForm({ ...form, sri_codigo_impuesto: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-semibold"
              >
                <option value="4">Código 4: IVA 15% (Tarifa General Vigente)</option>
                <option value="2">Código 2: IVA 12% (Tarifa Anterior / Especial)</option>
                <option value="0">Código 0: IVA 0% (Productos de Canasta Básica / Medicinas)</option>
                <option value="6">Código 6: No Objeto de Impuesto</option>
                <option value="7">Código 7: Exento de IVA</option>
              </select>
            </div>

            {/* Proveedor y Stock Mínimo */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium mb-1">Stock Mínimo (Alerta)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="5"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  value={form.stock_minimo}
                  onChange={(e) => setForm({ ...form, stock_minimo: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Proveedor Predeterminado</label>
                <select
                  value={form.proveedor_id}
                  onChange={(e) => setForm({ ...form, proveedor_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                >
                  <option value="">(Sin Proveedor)</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.razon_social}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Mapeo Contable NIIF */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-3 bg-slate-50 dark:bg-slate-800/40 space-y-2.5">
              <button
                type="button"
                onClick={() => setShowAccountingMapping(!showAccountingMapping)}
                className="w-full flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-purple-600" />
                  Mapeo de Cuentas Contables (NIIF / SRI)
                </span>
                <span className="text-[11px] text-indigo-600 dark:text-indigo-400">
                  {showAccountingMapping ? "Ocultar ▲" : "Configurar ▼"}
                </span>
              </button>

              {showAccountingMapping && (
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs animate-in fade-in">
                  <div>
                    <label className="block text-slate-500 mb-0.5 font-medium">Cuenta de Inventario (Activo)</label>
                    <select
                      value={form.cuenta_inventario_id}
                      onChange={(e) => setForm({ ...form, cuenta_inventario_id: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-mono"
                    >
                      <option value="">(Heredar de Categoría o 1.1.03.01 Inventario)</option>
                      {accounts
                        .filter((a) => a.tipo === "ACTIVO")
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.codigo} - {a.nombre}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-500 mb-0.5 font-medium">Cuenta de Ingreso por Ventas</label>
                    <select
                      value={form.cuenta_ingreso_id}
                      onChange={(e) => setForm({ ...form, cuenta_ingreso_id: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-mono"
                    >
                      <option value="">(Heredar de Categoría o 4.1.01 Ventas)</option>
                      {accounts
                        .filter((a) => a.tipo === "INGRESOS")
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.codigo} - {a.nombre}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-500 mb-0.5 font-medium">Cuenta de Costo de Ventas</label>
                    <select
                      value={form.cuenta_costo_id}
                      onChange={(e) => setForm({ ...form, cuenta_costo_id: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-mono"
                    >
                      <option value="">(Heredar de Categoría o 5.1.01 Costo de Ventas)</option>
                      {accounts
                        .filter((a) => a.tipo === "COSTOS")
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.codigo} - {a.nombre}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}
            </div>


            {/* FOTO DEL PRODUCTO: TOMAR CON CELULAR O SUBIR ARCHIVO */}
            <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
              <label className="block font-medium">Foto del Producto (Optimizada a WebP)</label>

              {/* Inputs ocultos */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageSelected(e.target.files?.[0] || null)}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleImageSelected(e.target.files?.[0] || null)}
              />

              {imagePreviewUrl ? (
                <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={imagePreviewUrl}
                      alt="Vista previa"
                      className="w-16 h-16 object-cover rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        {imageFile ? "Foto lista para subir" : "Foto actual del producto"}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {imageFile
                          ? `${(imageFile.size / 1024).toFixed(1)} KB • Se convertirá a WebP`
                          : "Guardada en el servidor"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 text-[11px] font-semibold flex items-center gap-1"
                      title="Tomar otra foto con la cámara del celular"
                    >
                      <Camera className="w-3 h-3" /> Tomar Foto
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-[11px] font-semibold flex items-center gap-1"
                      title="Elegir otra imagen de tu galería"
                    >
                      <Upload className="w-3 h-3" /> Subir otra
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="px-2.5 py-0.5 text-red-500 hover:underline text-[10px] font-medium text-center"
                    >
                      Quitar foto
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
                          !navigator.mediaDevices
                        ) {
                          cameraInputRef.current?.click();
                        } else {
                          setShowLiveCamera(true);
                        }
                      }}
                      className="p-3.5 rounded-2xl border-2 border-dashed border-indigo-300 dark:border-indigo-800 hover:border-indigo-500 dark:hover:border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 flex flex-col items-center justify-center gap-1.5 transition text-center group"
                    >
                      <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center group-hover:scale-110 transition">
                        <Camera className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <span className="font-bold text-xs">Tomar Foto con Celular</span>
                      <span className="text-[10px] text-indigo-500/80">Abre tu cámara</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowLiveCamera(true)}
                      className="text-[10px] text-slate-400 hover:text-indigo-600 underline text-center"
                    >
                      O abrir cámara en pantalla
                    </button>
                  </div>

                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-3.5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 flex flex-col items-center justify-center gap-1.5 transition text-center group"
                    >
                      <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center group-hover:scale-110 transition">
                        <Upload className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                      </div>
                      <span className="font-bold text-xs">Subir Foto</span>
                      <span className="text-[10px] text-slate-400">Galería o Archivo</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition shadow-md"
              >
                Guardar Producto
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: ADMINISTRAR / CREAR CATEGORÍAS */}
      {catModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 space-y-4 text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Tags className="w-4 h-4 text-indigo-600" />
                <span>Administrar Categorías</span>
              </div>
              <button
                type="button"
                onClick={() => setCatModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario de Crear / Editar Categoría */}
            <form onSubmit={handleSaveCategory} className="space-y-2.5 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="font-bold text-xs text-slate-700 dark:text-slate-200">
                {catForm.id ? "Editar Categoría" : "Nueva Categoría"}
              </div>

              <div>
                <input
                  type="text"
                  required
                  placeholder="Nombre de la categoría (ej. Bebidas, Snacks, Lácteos)..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                  value={catForm.nombre}
                  onChange={(e) => setCatForm({ ...catForm, nombre: e.target.value })}
                />
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Descripción breve (opcional)..."
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 text-[11px]"
                  value={catForm.descripcion}
                  onChange={(e) => setCatForm({ ...catForm, descripcion: e.target.value })}
                />
              </div>

              {/* Mapeo Contable de la Categoría */}
              <div className="space-y-1.5 pt-1 text-[11px]">
                <span className="font-bold text-slate-500 uppercase tracking-wider block text-[10px]">
                  Cuentas NIIF Predeterminadas para los productos de esta Categoría
                </span>
                <div className="grid grid-cols-1 gap-1.5">
                  <select
                    value={catForm.cuenta_inventario_id}
                    onChange={(e) => setCatForm({ ...catForm, cuenta_inventario_id: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-[10px]"
                  >
                    <option value="">Cta. Inventario (def: 1.1.03.01 Inventarios)</option>
                    {accounts
                      .filter((a) => a.tipo === "ACTIVO")
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.codigo} - {a.nombre}
                        </option>
                      ))}
                  </select>

                  <select
                    value={catForm.cuenta_ingreso_id}
                    onChange={(e) => setCatForm({ ...catForm, cuenta_ingreso_id: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-[10px]"
                  >
                    <option value="">Cta. Ingresos (def: 4.1.01.01 Ventas Gravadas)</option>
                    {accounts
                      .filter((a) => a.tipo === "INGRESOS")
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.codigo} - {a.nombre}
                        </option>
                      ))}
                  </select>

                  <select
                    value={catForm.cuenta_costo_id}
                    onChange={(e) => setCatForm({ ...catForm, cuenta_costo_id: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-[10px]"
                  >
                    <option value="">Cta. Costo (def: 5.1.01 Costo de Ventas)</option>
                    {accounts
                      .filter((a) => a.tipo === "COSTOS")
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.codigo} - {a.nombre}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                {catForm.id > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setCatForm({
                        id: 0,
                        nombre: "",
                        descripcion: "",
                        cuenta_inventario_id: "",
                        cuenta_ingreso_id: "",
                        cuenta_costo_id: "",
                      })
                    }
                    className="px-3 py-1 rounded-lg border border-slate-300 text-[11px] font-semibold"
                  >
                    Cancelar edición
                  </button>
                )}
                <button
                  type="submit"
                  disabled={savingCategory}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition"
                >
                  {savingCategory ? "Guardando..." : catForm.id ? "Actualizar" : "Crear Categoría"}
                </button>
              </div>
            </form>

            {/* Lista de Categorías Existentes */}
            <div className="space-y-2">
              <div className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                Categorías Existentes ({categories.length})
              </div>

              {categories.length === 0 ? (
                <p className="text-center py-4 text-slate-400 italic">
                  Aún no has creado ninguna categoría.
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100 dark:divide-slate-800">
                  {categories.map((c) => (
                    <div
                      key={c.id}
                      className="pt-1.5 first:pt-0 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                          <span>{c.nombre}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                            {c.total_productos} productos
                          </span>
                        </div>
                        {c.descripcion && (
                          <div className="text-[10px] text-slate-400">{c.descripcion}</div>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setCatForm({
                              id: c.id,
                              nombre: c.nombre,
                              descripcion: c.descripcion || "",
                              cuenta_inventario_id: c.cuenta_inventario_id ? String(c.cuenta_inventario_id) : "",
                              cuenta_ingreso_id: c.cuenta_ingreso_id ? String(c.cuenta_ingreso_id) : "",
                              cuenta_costo_id: c.cuenta_costo_id ? String(c.cuenta_costo_id) : "",
                            })
                          }
                          className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-600 dark:text-slate-300"
                          title="Editar categoría"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(c.id, c.nombre)}
                          className="p-1 rounded-lg border border-red-200 dark:border-red-900/60 text-red-600 hover:bg-red-50"
                          title="Eliminar categoría"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCatModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VISOR DE CÁMARA EN VIVO */}
      {showLiveCamera && (
        <CameraPhotoCapture
          onCapture={(file) => handleImageSelected(file)}
          onClose={() => setShowLiveCamera(false)}
        />
      )}
    </div>
  );
}
