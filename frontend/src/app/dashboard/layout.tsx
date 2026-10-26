"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  LayoutDashboard,
  ShoppingCart,
  ShoppingBag,
  Package,
  Users,
  Store,
  ExternalLink,
  LogOut,
  Bot,
  FileCheck2,
  BookOpen,
  Truck,
  ChevronDown,
  ChevronRight,
  Scale,
} from "lucide-react";

export default function TenantDashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [negocio, setNegocio] = useState<any>(null);

  useEffect(() => {
    apiFetch("/auth/validate.php")
      .then((res) => {
        if (res.session?.rol === "super_admin") {
          router.push("/super-admin");
          return;
        }
        setNegocio(res.session?.negocio || null);
      })
      .catch((err) => {
        if (!err.message?.includes("Suscripción expirada")) {
          router.push("/login");
        }
      });
  }, [pathname]);

  const [contabilidadExpanded, setContabilidadExpanded] = useState(true);
  const [currentTab, setCurrentTab] = useState<string>("estados_financieros");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const tab = urlParams.get("tab");
      if (tab) {
        setCurrentTab(tab);
      } else if (pathname === "/dashboard/contabilidad") {
        setCurrentTab("estados_financieros");
      }
    }

    const handleTabChange = (e: any) => {
      if (e.detail) {
        setCurrentTab(e.detail);
      }
    };
    window.addEventListener("pyme-contabilidad-tab", handleTabChange);
    return () => {
      window.removeEventListener("pyme-contabilidad-tab", handleTabChange);
    };
  }, [pathname]);

  const contabilidadSubItems = [
    { href: "/dashboard/contabilidad?tab=estados_financieros", label: "Estados Financieros", tabKey: "estados_financieros" },
    { href: "/dashboard/contabilidad?tab=diario", label: "Libro Diario", tabKey: "diario" },
    { href: "/dashboard/contabilidad?tab=mayor", label: "Libro Mayor", tabKey: "mayor" },
    { href: "/dashboard/contabilidad?tab=plan", label: "Plan de Cuentas", tabKey: "plan" },
    { href: "/dashboard/contabilidad?tab=facturacion_sri", label: "Facturación SRI", tabKey: "facturacion_sri" },
    { href: "/dashboard/contabilidad?tab=ats_sri", label: "Anexo ATS SRI", tabKey: "ats_sri" },
    { href: "/dashboard/contabilidad?tab=metricas", label: "Ratios Financieros", tabKey: "metricas" },
  ];

  const navItems = [
    { href: "/dashboard", label: "Resumen", icon: LayoutDashboard },
    { href: "/dashboard/pos", label: "Punto de Venta", icon: ShoppingCart },
    { href: "/dashboard/pedidos-web", label: "Tienda & Pedidos", icon: ShoppingBag },
    { href: "/dashboard/inventario", label: "Inventario", icon: Package },
    { href: "/dashboard/compras", label: "Compras / Proveedores", icon: Truck },
    { href: "/dashboard/clientes", label: "Clientes / Crédito", icon: Users },
    {
      href: "/dashboard/contabilidad",
      label: "Contabilidad & SRI",
      icon: BookOpen,
      isGroup: true,
      subItems: contabilidadSubItems,
    },
    { href: "/dashboard/whatsapp-ia", label: "Asistente WhatsApp IA", icon: Bot },
    { href: "/dashboard/mi-negocio", label: "Mi Negocio", icon: Store },
  ];

  const mobileNavItems = [
    { href: "/dashboard", label: "Resumen", icon: LayoutDashboard },
    { href: "/dashboard/pos", label: "POS", icon: ShoppingCart },
    { href: "/dashboard/pedidos-web", label: "Tienda", icon: ShoppingBag },
    { href: "/dashboard/inventario", label: "Stock", icon: Package },
    { href: "/dashboard/contabilidad", label: "Contabilidad", icon: BookOpen },
  ];

  const handleLogout = () => {
    localStorage.removeItem("pymeweb_token");
    localStorage.removeItem("pymeweb_user");
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row">
      <aside className="hidden md:flex md:w-64 md:flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 justify-between">
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            {negocio?.logo_url ? (
              <img
                src={negocio.logo_url}
                alt={negocio.nombre}
                className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                {negocio?.nombre?.[0] || "P"}
              </div>
            )}
            <div className="overflow-hidden">
              <h2 className="font-bold text-sm truncate">{negocio?.nombre || "Mi Negocio"}</h2>
              <span className="inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                {negocio?.estado || "Cargando"}
              </span>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isContabilidad = item.href === "/dashboard/contabilidad";
              const active = isContabilidad
                ? pathname.startsWith("/dashboard/contabilidad") || pathname.startsWith("/dashboard/facturacion-sri")
                : pathname === item.href;

              if (item.isGroup) {
                return (
                  <div key={item.href} className="space-y-1">
                    <div
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                        active
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <Link
                        href={item.href}
                        onClick={() => {
                          setCurrentTab("estados_financieros");
                          window.dispatchEvent(
                            new CustomEvent("pyme-contabilidad-tab", { detail: "estados_financieros" })
                          );
                        }}
                        className="flex items-center gap-3 flex-1"
                      >
                        <Icon className="w-5 h-5" />
                        <span>{item.label}</span>
                      </Link>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setContabilidadExpanded(!contabilidadExpanded);
                        }}
                        className={`p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition ${
                          active ? "text-white" : "text-slate-400"
                        }`}
                      >
                        {contabilidadExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {contabilidadExpanded && (
                      <div className="pl-4 pr-1 py-1 space-y-0.5 border-l-2 border-slate-200 dark:border-slate-800 ml-4 my-1">
                        {item.subItems.map((sub: any) => {
                          const isSubActive =
                            (pathname.startsWith("/dashboard/contabilidad") ||
                              pathname.startsWith("/dashboard/facturacion-sri")) &&
                            currentTab === sub.tabKey;

                          return (
                            <Link
                              key={sub.href}
                              href={sub.href}
                              onClick={(e) => {
                                setCurrentTab(sub.tabKey);
                                window.dispatchEvent(
                                  new CustomEvent("pyme-contabilidad-tab", { detail: sub.tabKey })
                                );
                                if (pathname.startsWith("/dashboard/contabilidad")) {
                                  e.preventDefault();
                                  router.push(sub.href);
                                }
                              }}
                              className={`block px-3 py-1.5 rounded-lg text-xs transition truncate ${
                                isSubActive
                                  ? "font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border-l-2 border-indigo-600 pl-2.5 shadow-xs"
                                  : "font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/70"
                              }`}
                            >
                              • {sub.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                    active
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          {negocio?.slug && (
            <Link
              href={`/${negocio.slug}`}
              target="_blank"
              className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              <span>Ver mi Tienda Web</span>
              <ExternalLink className="w-4 h-4" />
            </Link>
          )}
          <div className="flex items-center justify-between">
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:underline"
            >
              <LogOut className="w-4 h-4" /> Salir
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="font-bold text-sm truncate">{negocio?.nombre || "PymeWeb"}</span>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={handleLogout} className="p-2 text-red-600">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto">{children}</main>
      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 py-1.5">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isContabilidad = item.href === "/dashboard/contabilidad";
          const active = isContabilidad
            ? pathname.startsWith("/dashboard/contabilidad") || pathname.startsWith("/dashboard/facturacion-sri")
            : pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 text-[11px] font-medium ${
                active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500"
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="truncate max-w-[64px]">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
