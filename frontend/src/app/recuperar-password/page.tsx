"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";
import { KeyRound, ArrowLeft, Mail, CheckCircle2, Lock, Sparkles } from "lucide-react";

function RecuperarPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tokenFromUrl = searchParams.get("token") || "";

  const [token, setToken] = useState(tokenFromUrl);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [devLink, setDevLink] = useState<string | null>(null);

  useEffect(() => {
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
    }
  }, [tokenFromUrl]);

  // Paso 1: Solicitar enlace de recuperación
  const handleRequestToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMsg("");
    setDevLink(null);

    try {
      const res = await apiFetch("/auth/forgot-password.php", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMsg(res.message || "Enlace de recuperación generado.");
      if (res.dev_reset_link) {
        setDevLink(res.dev_reset_link);
      }
    } catch (err: any) {
      setError(err.message || "Error al solicitar restablecimiento.");
    } finally {
      setLoading(false);
    }
  };

  // Paso 2: Cambiar la contraseña con el token
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);
    setError("");
    setMsg("");

    try {
      const res = await apiFetch("/auth/reset-password.php", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setMsg(res.message || "Contraseña actualizada exitosamente.");
      setTimeout(() => {
        router.push("/login");
      }, 2500);
    } catch (err: any) {
      setError(err.message || "Error al actualizar contraseña.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4">
      <div className="fixed top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold">Recuperar Contraseña</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {token
              ? "Ingresa tu nueva contraseña para acceder a PymeWeb"
              : "Ingresa tu correo registrado y te ayudaremos a restablecerla"}
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-xs">
            {error}
          </div>
        )}

        {msg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{msg}</span>
          </div>
        )}

        {/* Enlace de desarrollo si está disponible */}
        {devLink && (
          <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-xs space-y-1.5">
            <div className="font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> Enlace de prueba (Modo Dev):
            </div>
            <a
              href={devLink}
              className="block text-[11px] text-indigo-600 dark:text-indigo-400 underline break-all"
            >
              {devLink}
            </a>
          </div>
        )}

        {!token ? (
          // FORMULARIO: SOLICITAR TOKEN
          <form onSubmit={handleRequestToken} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  placeholder="ejemplo@pymeweb.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-indigo-600/20 transition active:scale-95"
            >
              {loading ? "Enviando enlace..." : "Enviar Enlace de Recuperación"}
            </button>
          </form>
        ) : (
          // FORMULARIO: ESTABLECER NUEVA CONTRASEÑA
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1.5">
                Nueva Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  placeholder="Mínimo 6 caracteres"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1.5">
                Confirmar Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  placeholder="Repite tu contraseña"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-indigo-600/20 transition active:scale-95"
            >
              {loading ? "Actualizando..." : "Restablecer Contraseña"}
            </button>

            <button
              type="button"
              onClick={() => setToken("")}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              Solicitar otro enlace
            </button>
          </form>
        )}

        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Volver a Iniciar Sesión
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function RecuperarPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Cargando...</div>}>
      <RecuperarPasswordContent />
    </Suspense>
  );
}
