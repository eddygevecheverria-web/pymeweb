"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Store, CheckCircle2, Sparkles } from "lucide-react";

export default function RegistroPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    nombre_negocio: "",
    nombre_dueno: "",
    telefono: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/auth/register.php", {
        method: "POST",
        body: JSON.stringify(form),
      });
      localStorage.setItem("pymeweb_token", res.token);
      localStorage.setItem("pymeweb_user", JSON.stringify(res.user));
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2 font-bold text-xl text-indigo-600 dark:text-indigo-400">
          <Store className="w-6 h-6" />
          <span>PymeWeb SaaS</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium hover:underline">
            Iniciar Sesión
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full grid md:grid-cols-2 gap-10 items-center px-6 py-10">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            <Sparkles className="w-4 h-4" /> 7 Días de Prueba Gratis — Sin Tarjeta
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight leading-tight">
            Digitaliza tu negocio con Punto de Venta, Inventario y Tienda Online
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-lg">
            Crea tu cuenta en segundos y obtén acceso inmediato durante 7 días a todas las herramientas de PymeWeb.
          </p>
          <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
            {[
              "Punto de Venta (POS) optimizado para celular y PC",
              "Control de inventario, clientes y crédito directo (cuentas por cobrar)",
              "Facturación electrónica con tu propio logotipo",
              "Catálogo web público con pedidos en tiempo real",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 space-y-4"
        >
          <h2 className="text-2xl font-bold">Comienza tus 7 días gratis</h2>
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Nombre de tu Negocio</label>
            <input
              type="text"
              required
              placeholder="Ej. Minimarket San José"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-indigo-500 outline-none"
              value={form.nombre_negocio}
              onChange={(e) => setForm({ ...form, nombre_negocio: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tu Nombre</label>
              <input
                type="text"
                required
                placeholder="Juan Pérez"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-indigo-500 outline-none"
                value={form.nombre_dueno}
                onChange={(e) => setForm({ ...form, nombre_dueno: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">WhatsApp / Teléfono</label>
              <input
                type="tel"
                placeholder="+51 999 888 777"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-indigo-500 outline-none"
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Correo Electrónico</label>
            <input
              type="email"
              required
              placeholder="dueno@minegocio.com"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-indigo-500 outline-none"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Contraseña</label>
            <input
              type="password"
              required
              minLength={6}
              placeholder="Mínimo 6 caracteres"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-indigo-500 outline-none"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold transition"
          >
            {loading ? "Creando tu cuenta..." : "Crear mi cuenta y activar 7 días gratis"}
          </button>
        </form>
      </main>
    </div>
  );
}
