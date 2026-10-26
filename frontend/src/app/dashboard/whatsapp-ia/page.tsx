"use client";

import { useEffect, useState, useRef } from "react";
import { apiFetch } from "@/lib/api";
import {
  Bot,
  Save,
  CheckCircle2,
  Copy,
  Send,
  Sparkles,
  RefreshCw,
  ShoppingBag,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  Zap,
} from "lucide-react";

export default function WhatsAppIAPage() {
  const [config, setConfig] = useState<any>({
    provider: "meta_official",
    phone_number_id: "",
    api_token: "",
    has_api_token: 0,
    ai_provider: "gemini",
    ai_api_key: "",
    has_ai_api_key: 0,
    ai_model: "gemini-1.5-flash",
    system_prompt_extra: "",
    webhook_secret: "",
    activo: 1,
  });

  const [webhookUrl, setWebhookUrl] = useState("");
  const [business, setBusiness] = useState<any>(null);
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Simulador de Chat
  const [simMessage, setSimMessage] = useState("¿Tienen zapatos talla 40?");
  const [simulating, setSimulating] = useState(false);
  const [chatLog, setChatLog] = useState<
    { sender: "user" | "ia"; text: string; time: string }[]
  >([
    {
      sender: "ia",
      text: "¡Hola! 👋 Soy tu asistente de ventas con IA. Puedo consultar el stock en tiempo real y guiar a tus clientes directo al carrito. ¡Escríbeme una consulta como si fueras un cliente!",
      time: "Ahora",
    },
  ]);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/tenant/whatsapp-assistant.php");
      if (res.config) {
        setConfig((prev: any) => ({
          ...prev,
          ...res.config,
          api_token: "", // Por seguridad no viene el texto plano
          ai_api_key: "",
        }));
      }
      setWebhookUrl(res.webhook_url || "");
      setBusiness(res.business || null);
      setRecentMessages(res.recent_messages || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatLog]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      const payload: any = {
        action: "save_config",
        provider: config.provider,
        phone_number_id: config.phone_number_id,
        ai_provider: config.ai_provider,
        ai_model: config.ai_model,
        system_prompt_extra: config.system_prompt_extra,
        activo: config.activo ? 1 : 0,
      };

      if (config.api_token) payload.api_token = config.api_token;
      if (config.ai_api_key) payload.ai_api_key = config.ai_api_key;

      await apiFetch("/tenant/whatsapp-assistant.php", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
      loadData();
    } catch (err: any) {
      alert("Error al guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSimulateChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMsg = simMessage.trim();
    if (!cleanMsg || simulating) return;

    // Agregar mensaje del usuario a la vista
    const userBubble = {
      sender: "user" as const,
      text: cleanMsg,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setChatLog((prev) => [...prev, userBubble]);
    setSimMessage("");
    setSimulating(true);

    try {
      const res = await apiFetch("/tenant/whatsapp-assistant.php", {
        method: "POST",
        body: JSON.stringify({
          action: "simulate_chat",
          message: cleanMsg,
          phone: "+593999123456",
          name: "Cliente WhatsApp",
        }),
      });

      if (res.reply) {
        setChatLog((prev) => [
          ...prev,
          {
            sender: "ia",
            text: res.reply,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }
    } catch (err: any) {
      setChatLog((prev) => [
        ...prev,
        {
          sender: "ia",
          text: "⚠️ Error al consultar el asistente: " + err.message,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setSimulating(false);
    }
  };

  const copyToClipboard = (text: string, type: "webhook" | "secret") => {
    navigator.clipboard.writeText(text);
    if (type === "webhook") {
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    } else {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Bot className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-black">Asistente de WhatsApp con IA</h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Convierte a WhatsApp en tu mejor canal de ventas automático. La IA consulta tu stock en tiempo real
            (solo lectura) y genera enlaces directos al carrito de compra.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 flex items-center gap-3 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>¡Configuración del Asistente IA guardada exitosamente!</span>
        </div>
      )}

      {/* Grid Principal: Configuración a la izquierda, Simulador Interactivo a la derecha */}
      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* Columna Izquierda: Configuración del Webhook y LLM */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card Webhook URL */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              <h2 className="font-bold text-base">URL del Webhook de WhatsApp</h2>
            </div>
            <p className="text-xs text-slate-500">
              Copia esta URL en tu panel de Desarrolladores de Meta (WhatsApp Cloud API) o en tu instancia de
              Evolution API / Baileys para recibir mensajes entrantes:
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Callback URL (Webhook)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-800/80 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 select-all"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(webhookUrl, "webhook")}
                    className="shrink-0 px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedWebhook ? "Copiado!" : "Copiar"}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Verify Token (Token de Verificación Meta)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={config.webhook_secret || "pymeweb_webhook_token_2026"}
                    className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-800/80 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 select-all"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(config.webhook_secret || "pymeweb_webhook_token_2026", "secret")}
                    className="shrink-0 px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedSecret ? "Copiado!" : "Copiar"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Formulario de Configuración del Asistente */}
          <form
            onSubmit={handleSaveConfig}
            className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="font-bold text-base">Motor de Inteligencia Artificial (LLM)</h2>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold">
                <input
                  type="checkbox"
                  checked={!!config.activo}
                  onChange={(e) => setConfig({ ...config, activo: e.target.checked ? 1 : 0 })}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span>Asistente Activo</span>
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Proveedor de WhatsApp
                </label>
                <select
                  value={config.provider}
                  onChange={(e) => setConfig({ ...config, provider: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
                >
                  <option value="meta_official">Meta Cloud API (Oficial)</option>
                  <option value="evolution_api">Evolution API / Baileys</option>
                  <option value="generic_webhook">Webhook Genérico</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Phone Number ID o Instancia
                </label>
                <input
                  type="text"
                  placeholder="Ej. 1048291048592 o my-store"
                  value={config.phone_number_id || ""}
                  onChange={(e) => setConfig({ ...config, phone_number_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Token de Acceso de WhatsApp (Meta Token o API Key Evolution)
              </label>
              <input
                type="password"
                placeholder={config.has_api_token ? "•••••••••••• (Guardado previamente)" : "Ingresa el token de envío"}
                value={config.api_token || ""}
                onChange={(e) => setConfig({ ...config, api_token: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Utilizado para enviar automáticamente las respuestas salientes a los clientes.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Proveedor de Inteligencia Artificial
                  </label>
                  <select
                    value={config.ai_provider}
                    onChange={(e) => {
                      const prov = e.target.value;
                      setConfig({
                        ...config,
                        ai_provider: prov,
                        ai_model: prov === "openai" ? "gpt-4o-mini" : "gemini-1.5-flash",
                      });
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
                  >
                    <option value="gemini">Google Gemini (Recomendado)</option>
                    <option value="openai">OpenAI (ChatGPT)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Modelo de LLM
                  </label>
                  <input
                    type="text"
                    value={config.ai_model || ""}
                    onChange={(e) => setConfig({ ...config, ai_model: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm font-mono"
                    placeholder="gemini-1.5-flash o gpt-4o-mini"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  API Key del Modelo ({config.ai_provider === "openai" ? "OpenAI" : "Google Gemini"})
                </label>
                <input
                  type="password"
                  placeholder={config.has_ai_api_key ? "•••••••••••• (Guardada previamente)" : "Ej. AIzaSy..."}
                  value={config.ai_api_key || ""}
                  onChange={(e) => setConfig({ ...config, ai_api_key: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Si se deja en blanco, utilizará la clave global configurada en el servidor (.env).
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Instrucciones personalizadas para la IA (System Prompt Extra)
                </label>
                <textarea
                  rows={3}
                  value={config.system_prompt_extra || ""}
                  onChange={(e) => setConfig({ ...config, system_prompt_extra: e.target.value })}
                  placeholder="Ej. Resalta siempre que realizamos envíos gratis a todo el país en compras mayores a $30. Nuestro horario de atención física es de 9:00 AM a 7:00 PM."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Acceso de solo lectura al catálogo garantizado.
              </span>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition"
              >
                <Save className="w-4 h-4" />
                {saving ? "Guardando..." : "Guardar Configuración"}
              </button>
            </div>
          </form>
        </div>

        {/* Columna Derecha: Simulador Interactivo de WhatsApp */}
        <div className="lg:col-span-5 space-y-4 sticky top-6">
          <div className="bg-slate-900 text-slate-100 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col h-[640px]">
            {/* Header estilo WhatsApp */}
            <div className="bg-slate-800/90 px-4 py-3 flex items-center justify-between border-b border-slate-700/50">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center font-bold text-white shadow-md">
                    <Bot className="w-5 h-5" />
                  </div>
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900"></span>
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight">
                    {business?.nombre ? `${business.nombre} (IA)` : "Asistente Virtual"}
                  </h3>
                  <span className="text-[11px] text-emerald-400 font-medium">En línea • Stock Activo</span>
                </div>
              </div>

              <div className="text-[11px] px-2.5 py-1 rounded-full bg-slate-700 text-slate-300 font-mono">
                Simulador
              </div>
            </div>

            {/* Banner explicativo */}
            <div className="bg-emerald-950/40 border-b border-emerald-900/40 px-4 py-2 text-[11px] text-emerald-300 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>Prueba cómo responde tu IA a las consultas de stock de los clientes.</span>
            </div>

            {/* Área de mensajes con scroll */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#0b141a]">
              {chatLog.map((c, i) => (
                <div
                  key={i}
                  className={`flex flex-col max-w-[85%] ${
                    c.sender === "user" ? "ml-auto items-end" : "mr-auto items-start"
                  }`}
                >
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
                      c.sender === "user"
                        ? "bg-[#005c4b] text-emerald-50 rounded-tr-none"
                        : "bg-[#202c33] text-slate-100 rounded-tl-none border border-slate-800"
                    }`}
                  >
                    {c.text}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 px-1">{c.time}</span>
                </div>
              ))}

              {simulating && (
                <div className="flex items-center gap-2 text-xs text-slate-400 bg-[#202c33] px-3.5 py-2 rounded-2xl rounded-tl-none w-max border border-slate-800">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce delay-150"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce delay-300"></span>
                  </div>
                  <span className="text-[11px]">Consultando stock y pensando...</span>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input interactivo */}
            <form
              onSubmit={handleSimulateChat}
              className="p-3 bg-slate-800/80 border-t border-slate-700/60 flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Ej: ¿Tienen zapatos talla 40? ¿Qué precio tienen?"
                value={simMessage}
                onChange={(e) => setSimMessage(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={simulating || !simMessage.trim()}
                className="w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white flex items-center justify-center transition shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Botones de prueba rápida */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-[11px] text-slate-400 self-center">Pruebas rápidas:</span>
            {[
              "¿Tienen zapatos talla 40?",
              "¿Qué bebidas tienen disponibles?",
              "Hola, ¿cuánto cuesta el envío?",
            ].map((suggest, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSimMessage(suggest)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] transition"
              >
                {suggest}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Historial de Mensajes Reales Recibidos y Respondidos */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="font-bold text-base">Historial de Conversaciones Reales (WhatsApp)</h2>
          </div>
          <span className="text-xs text-slate-500">
            {recentMessages.length} mensaje(s) registrados
          </span>
        </div>

        {recentMessages.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">
            No hay mensajes registrados aún. Cuando tus clientes te escriban al webhook de WhatsApp o pruebes el simulador, aparecerán aquí.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 rounded-l-xl">Fecha / Hora</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Teléfono</th>
                  <th className="px-4 py-3">Dirección</th>
                  <th className="px-4 py-3 rounded-r-xl">Contenido del Mensaje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentMessages.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap font-mono">{m.created_at}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">{m.cliente_nombre || "Cliente"}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{m.cliente_telefono}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          m.direccion === "entrante"
                            ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400"
                            : "bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400"
                        }`}
                      >
                        {m.direccion === "entrante" ? "Entrante (Cliente)" : "Saliente (IA)"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-md break-words whitespace-pre-wrap">
                      {m.mensaje}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

