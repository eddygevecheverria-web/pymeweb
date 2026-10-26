"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { apiFetch } from "@/lib/api";
import {
  CheckCircle2,
  Zap,
  ShieldCheck,
  ShoppingBag,
  Receipt,
  Truck,
  BarChart3,
  Layers,
  ArrowRight,
  Clock,
  CreditCard,
  Building2,
  Copy,
  Check,
  MessageCircle,
  FileText,
  HelpCircle,
  LogIn,
  UserPlus,
  Sparkles,
  ChevronDown,
  DollarSign,
  PhoneCall,
  Store,
  Printer,
  Compass,
} from "lucide-react";

interface PlanInfo {
  tipo: string;
  nombre: string;
  dias: number;
  precio: number;
  descripcion: string;
}

interface SubscriptionData {
  success: boolean;
  planes: {
    mensual: PlanInfo;
    anual: PlanInfo;
  };
  dias_prueba: number;
  datos_bancarios: string;
  whatsapp_soporte: string;
  email_soporte: string;
}

export default function LandingMarketingPage() {
  const [subData, setSubData] = useState<SubscriptionData>({
    success: true,
    planes: {
      mensual: {
        tipo: "mensual",
        nombre: "Plan Mensual",
        dias: 30,
        precio: 15.0,
        descripcion: "Acceso completo durante 30 días con todas las funciones del ERP.",
      },
      anual: {
        tipo: "anual",
        nombre: "Paquete Anual (1 Año)",
        dias: 365,
        precio: 130.0,
        descripcion: "Acceso completo durante 365 días con ahorro especial y soporte VIP.",
      },
    },
    dias_prueba: 7,
    datos_bancarios:
      "Banco Pichincha - Cuenta Corriente # 2100458921\nTitular: PymeWeb ERP S.A.S.\nRUC: 1793148921001\nTipo: Transferencia Directa o Interbancaria",
    whatsapp_soporte: "0985559516",
    email_soporte: "soporte@pymeweb.com",
  });

  const [copiedBank, setCopiedBank] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    apiFetch<SubscriptionData>("/public/subscription-info.php")
      .then((data) => {
        if (data && data.success) {
          setSubData(data);
        }
      })
      .catch((err) => {
        console.warn("Using fallback subscription info:", err);
      });
  }, []);

  const copyBankData = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(subData.datos_bancarios);
      setCopiedBank(true);
      setTimeout(() => setCopiedBank(false), 2500);
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const whatsappClean = (subData.whatsapp_soporte || "").replace(/\D/g, "");
  const whatsappUrl = whatsappClean.startsWith("593")
    ? `https://wa.me/${whatsappClean}`
    : `https://wa.me/593${whatsappClean.replace(/^0/, "")}`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-indigo-500 selection:text-white transition-colors duration-200">
      {/* ===================== NAVBAR ===================== */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/85 dark:bg-slate-900/85 border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <span className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">
                PymeWeb
              </span>
              <span className="ml-1 text-xs px-2 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 uppercase tracking-wider">
                ERP Cloud
              </span>
            </div>
          </Link>

          {/* Navigation Links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-8 text-sm font-semibold text-slate-600 dark:text-slate-300">
            <a href="#caracteristicas" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">
              Características
            </a>
            <a href="#modulos" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">
              Módulos
            </a>
            <a href="#planes" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">
              Planes & Suscripción
            </a>
            <a href="#transferencia" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">
              Datos Bancarios
            </a>
            <a href="#faq" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">
              Preguntas Frecuentes
            </a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            <ThemeToggle />

            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 transition shadow-sm"
            >
              <LogIn className="w-4 h-4 text-indigo-500" />
              <span>Acceso Plataforma</span>
            </Link>

            <Link
              href="/registro"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-md shadow-indigo-600/30 hover:shadow-indigo-600/40 hover:-translate-y-0.5 transition duration-150"
            >
              <Sparkles className="w-4 h-4" />
              <span>Prueba {subData.dias_prueba} Días Gratis</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ===================== HERO SECTION ===================== */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-32">
        {/* Glow ambient backgrounds */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-gradient-to-tr from-indigo-500/20 via-violet-500/20 to-purple-500/10 blur-3xl pointer-events-none rounded-full -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs sm:text-sm font-semibold shadow-sm">
            <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
            <span>ERP Integral para Emprendedores y Pymes en Ecuador</span>
            <span className="bg-indigo-600 text-white text-[11px] px-2 py-0.5 rounded-full font-bold ml-1">
              {subData.dias_prueba} DÍAS GRATIS
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white max-w-4xl mx-auto leading-tight">
            Controla tu Negocio, Factura al SRI y Vende Online{" "}
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 dark:from-indigo-400 dark:via-violet-400 dark:to-purple-300 bg-clip-text text-transparent">
              en un solo sistema
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Punto de venta POS con lector de código de barras, facturación electrónica autorizada por el SRI, tienda virtual B2C para pedidos a WhatsApp y despacho con motorizados o courier nacional.
          </p>

          {/* CTA Group */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/registro"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-bold text-base bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/40 hover:-translate-y-0.5 transition duration-150"
            >
              <span>Comenzar Prueba Gratis ({subData.dias_prueba} Días)</span>
              <ArrowRight className="w-5 h-5" />
            </Link>

            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl font-semibold text-base bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition shadow-sm"
            >
              <LogIn className="w-5 h-5 text-indigo-500" />
              <span>Acceso a la Plataforma</span>
            </Link>

            <a
              href="#planes"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold text-base text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition"
            >
              <DollarSign className="w-5 h-5" />
              <span>Ver Planes y Suscripción</span>
            </a>
          </div>

          {/* Trust Guarantees */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Sin tarjeta de crédito requerida</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Pago fácil por Transferencia Bancaria</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Facturación SRI 100% Legal</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Activación inmediata</span>
            </div>
          </div>

          {/* Interactive Feature Mockup Banner */}
          <div className="mt-12 max-w-5xl mx-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 shadow-2xl p-4 sm:p-6 backdrop-blur-md">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500" />
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="ml-2 font-mono font-semibold text-slate-600 dark:text-slate-400">
                  https://app.pymeweb.com/dashboard
                </span>
              </div>
              <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                Online • SRI Conectado
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6 text-left">
              <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm mb-1">
                  <Printer className="w-4 h-4" />
                  <span>Punto de Venta POS</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Ventas al instante con lector o cámara, ticket térmico y control de caja.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm mb-1">
                  <Receipt className="w-4 h-4" />
                  <span>Facturación SRI</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Emisión legal de Facturas, Notas de Crédito, Retenciones con RIDE y XML.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/50">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm mb-1">
                  <ShoppingBag className="w-4 h-4" />
                  <span>Tienda Online B2C</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Catálogo propio con carrito, ubicación GPS del cliente y pedido a WhatsApp.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-purple-50/60 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/50">
                <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold text-sm mb-1">
                  <Truck className="w-4 h-4" />
                  <span>Despacho & Envíos</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Envío motorizado o courier con cálculo dinámico local vs interprovincial.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== CARACTERÍSTICAS DESTACADAS ===================== */}
      <section id="caracteristicas" className="py-20 bg-white dark:bg-slate-900/60 border-y border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-800">
              ¿Por qué elegir PymeWeb ERP?
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
              Todo lo que tu negocio necesita en una sola suscripción
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">
              Diseñado pensando en la realidad del comercio y servicios en Ecuador: cobros rápidos, cumplimiento tributario y ventas por internet sin comisiones abusivas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-4 hover:shadow-lg transition">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Velocidad Extrema en el Mostrador
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Vende en segundos. Compatible con lectores de código de barras USB, Bluetooth o la cámara de tu smartphone. Imprime tickets térmicos de 58mm/80mm o formato A4 al instante.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-4 hover:shadow-lg transition">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <Receipt className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Facturación Electrónica SRI Directa
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Genera facturas legales autorizadas por el SRI con firma electrónica (.p12). Envío automático del PDF RIDE y XML por correo a tus clientes con validación de clave de acceso.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-4 hover:shadow-lg transition">
              <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                <Store className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Tu Propia Tienda Online en Minutos
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Publica tu catálogo con fotos y precios. Tus clientes seleccionan productos, cargan su ubicación GPS para el envío y te envían el pedido ordenado y listo directamente a tu WhatsApp.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== MÓDULOS DEL SISTEMA ===================== */}
      <section id="modulos" className="py-20 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950 px-3 py-1 rounded-full border border-violet-200 dark:border-violet-800">
              Módulos Completos
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
              Diseñado para operar todo el flujo de tu empresa
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">
              Desde la compra a proveedores hasta la entrega final del pedido en la puerta del cliente.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 1. POS */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Printer className="w-5 h-5" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                Punto de Venta POS & Tickets
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Cobro en caja ágil, múltiples métodos de pago (efectivo, transferencia, tarjeta), descuentos, control de turnos y arqueos de caja.
              </p>
            </div>

            {/* 2. Facturación SRI */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                Facturación Electrónica SRI
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Firma digital PKCS#12, ambiente de pruebas y producción, Facturas, Notas de Crédito y generación del anexo transaccional ATS.
              </p>
            </div>

            {/* 3. Tienda Online */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                Tienda Virtual B2C WhatsApp
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Enlace web exclusivo con la marca de tu negocio, carrito interactivo, cálculo de costo de envío automático y recepción en WhatsApp.
              </p>
            </div>

            {/* 4. Envíos y Logística */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Truck className="w-5 h-5" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                Despacho & Envíos (Motorizado / Courier)
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Asignación de pedidos a motorizado propio con teléfono o a empresas de courier (Servientrega, Laar, etc.) con número de guía de rastreo y envío por WhatsApp.
              </p>
            </div>

            {/* 5. Inventario & Kardex */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                Control de Inventario & Kardex
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Stock sincronizado en tiempo real con las ventas POS y tienda virtual. Alertas automáticas de productos por agotarse y valorización de inventario.
              </p>
            </div>

            {/* 6. Contabilidad & Reportes */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                Contabilidad NIIF y Reportes
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Asientos automáticos en el Libro Diario, Estado de Resultados, Balance General y métricas financieras para tomar mejores decisiones.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== PLANES Y SUSCRIPCIÓN ===================== */}
      <section id="planes" className="py-20 bg-white dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
              Planes Transparentes y Económicos
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
              Elige el plan ideal para hacer crecer tu empresa
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">
              Comienza hoy mismo con una prueba gratis de {subData.dias_prueba} días sin ingresar tarjeta. Luego suscríbete fácilmente mediante transferencia bancaria.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch max-w-6xl mx-auto">
            {/* PLAN PRUEBA GRATUITA */}
            <div className="rounded-3xl p-8 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between hover:shadow-xl transition relative">
              <div className="space-y-6">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Sin costo inicial
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    Prueba Gratis
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Explora todo el potencial del sistema sin compromiso.
                  </p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black text-slate-900 dark:text-white">$0</span>
                  <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    / {subData.dias_prueba} días
                  </span>
                </div>

                <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Acceso completo a todos los módulos</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Punto de Venta POS ilimitado</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Facturación Electrónica SRI</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Tienda Virtual B2C para WhatsApp</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Sin tarjeta de crédito requerida</span>
                  </li>
                </ul>
              </div>

              <div className="pt-8">
                <Link
                  href="/registro"
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition shadow-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Crear Cuenta de Prueba</span>
                </Link>
              </div>
            </div>

            {/* PLAN MENSUAL */}
            <div className="rounded-3xl p-8 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between hover:shadow-xl transition relative">
              <div className="space-y-6">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    Flexibilidad Total
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    {subData.planes.mensual?.nombre || "Plan Mensual"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Paga mes a mes según el crecimiento de tu negocio.
                  </p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black text-slate-900 dark:text-white">
                    ${Number(subData.planes.mensual?.precio || 15).toFixed(2)}
                  </span>
                  <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    / mes (30 días)
                  </span>
                </div>

                <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>Todas las funciones ilimitadas</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>Emisión ilimitada de comprobantes SRI</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>Despacho con motorizado & courier</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>Contabilidad y reportes NIIF</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>Pago fácil por transferencia bancaria</span>
                  </li>
                </ul>
              </div>

              <div className="pt-8">
                <Link
                  href="/registro"
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-md shadow-indigo-600/20"
                >
                  <span>Elegir Plan Mensual</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* PAQUETE ANUAL (DESTACADO) */}
            <div className="rounded-3xl p-8 bg-gradient-to-b from-indigo-900 via-indigo-950 to-slate-900 text-white border-2 border-indigo-500 flex flex-col justify-between shadow-2xl shadow-indigo-500/20 relative lg:-translate-y-3">
              {/* Badge destacado */}
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 px-4 py-1 rounded-full text-xs font-black tracking-wide uppercase shadow-md flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 fill-current" />
                <span>Recomendado • Mayor Ahorro</span>
              </div>

              <div className="space-y-6 pt-2">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                    1 Año de Servicio Continuo
                  </span>
                  <h3 className="text-2xl font-black text-white mt-1">
                    {subData.planes.anual?.nombre || "Paquete Anual (1 Año)"}
                  </h3>
                  <p className="text-xs text-indigo-200 mt-1">
                    Asegura la tranquilidad de tu negocio durante 365 días.
                  </p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black text-white">
                    ${Number(subData.planes.anual?.precio || 130).toFixed(2)}
                  </span>
                  <span className="text-sm font-semibold text-indigo-200">
                    / año (365 días)
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-indigo-800/40 border border-indigo-600/50 text-xs text-indigo-100 flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Ahorras más de $50 al año en comparación con el pago mes a mes.
                  </span>
                </div>

                <ul className="space-y-3 text-sm text-indigo-100">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>365 días completos sin interrupciones</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Soporte prioritario VIP por WhatsApp</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Todas las actualizaciones del SRI incluidas</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Copia de seguridad en la nube garantizada</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Activación con 1 sola transferencia</span>
                  </li>
                </ul>
              </div>

              <div className="pt-8">
                <Link
                  href="/registro"
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-black text-sm bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 transition shadow-lg shadow-amber-500/30"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Obtener Paquete Anual</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== DATOS BANCARIOS PARA TRANSFERENCIA ===================== */}
      <section id="transferencia" className="py-20 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-800">
              Pago 100% Seguro Sin Tarjeta
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
              Cuentas Bancarias Oficiales para Suscripción
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-base">
              Realiza tu transferencia bancaria directa o interbancaria a nuestra cuenta autorizada y reporta tu comprobante en la plataforma para activación inmediata.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                    Datos Oficiales para Transferencias
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Válido para Plan Mensual (${Number(subData.planes.mensual?.precio || 15).toFixed(2)}) o Paquete Anual (${Number(subData.planes.anual?.precio || 130).toFixed(2)})
                  </p>
                </div>
              </div>

              <button
                onClick={copyBankData}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition border border-slate-200 dark:border-slate-700"
              >
                {copiedBank ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span>¡Copiado al Portapapeles!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar Datos Bancarios</span>
                  </>
                )}
              </button>
            </div>

            {/* Cuadro de texto con datos bancarios */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-sm leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap select-all">
              {subData.datos_bancarios}
            </div>

            {/* Pasos para suscribirse */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 space-y-1">
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">PASO 1</span>
                <p className="font-bold text-sm text-slate-900 dark:text-white">Crea tu Cuenta</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Regístrate gratis y aprovecha los {subData.dias_prueba} días de prueba.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 space-y-1">
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">PASO 2</span>
                <p className="font-bold text-sm text-slate-900 dark:text-white">Transfiere el Monto</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Elige Plan Mensual o Paquete Anual y realiza la transferencia.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 space-y-1">
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">PASO 3</span>
                <p className="font-bold text-sm text-slate-900 dark:text-white">Sube el Comprobante</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  En tu panel carga el comprobante y tu plan se renovará de inmediato.
                </p>
              </div>
            </div>

            {/* Asistencia directa WhatsApp */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-sm text-emerald-900 dark:text-emerald-100">
                    ¿Dudas con la transferencia o activación?
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    Escríbenos directamente a WhatsApp ({subData.whatsapp_soporte || "0985559516"}) y un asesor te atenderá al instante.
                  </p>
                </div>
              </div>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-md shadow-emerald-600/20"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Contactar por WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== FAQ ===================== */}
      <section id="faq" className="py-20 bg-white dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-800">
              Respuestas Claras
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
              Preguntas Frecuentes
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-base">
              Todo lo que necesitas saber antes de empezar con PymeWeb ERP.
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                q: `¿Cómo funciona la prueba gratuita de ${subData.dias_prueba} días?`,
                a: `Al registrarte recibes acceso completo durante ${subData.dias_prueba} días con todos los módulos habilitados (POS, Facturación SRI, Tienda Virtual, Despacho, Inventario y Contabilidad). No solicitamos tarjeta de crédito ni compromiso alguno.`,
              },
              {
                q: "¿Qué necesito para emitir facturas electrónicas válidas con el SRI?",
                a: "Solo necesitas tu archivo de firma electrónica en formato .p12 (emitida por Security Data, Banco Central, ANF, UANATACA, etc.), tu contraseña de firma y tu RUC activo. Puedes probar primero en ambiente de pruebas antes de pasar a producción.",
              },
              {
                q: "¿Cómo funciona la tienda virtual y los pedidos por WhatsApp?",
                a: "PymeWeb genera automáticamente un enlace para tu tienda (ej. app.pymeweb.com/tu-negocio). Tus clientes ven tu catálogo, añaden al carrito, cargan su ubicación GPS de entrega y al finalizar se genera un pedido detallado que llega directo a tu número de WhatsApp.",
              },
              {
                q: "¿Cómo se calculan los envíos por motorizado o courier?",
                a: "El sistema permite configurar el valor del envío local (para tu misma ciudad con motorizado propio o asignado) y el costo para envíos a otras ciudades/provincias mediante empresas de courier, con generación de datos de guía y rastreo.",
              },
              {
                q: "¿Cómo renuevo mi suscripción después de la prueba gratis?",
                a: "Puedes elegir el Plan Mensual ($15.00/mes) o el Paquete Anual ($130.00/año). Realizas una transferencia a nuestra cuenta bancaria oficial, subes la foto del comprobante desde tu panel y el administrador aprueba tu renovación en minutos.",
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-800/40 overflow-hidden"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-5 text-left font-bold text-base text-slate-900 dark:text-white flex items-center justify-between gap-4"
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-indigo-500 shrink-0 transition-transform duration-200 ${
                      openFaq === idx ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-200/60 dark:border-slate-700/60 pt-4">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== BANNER FINAL CTA ===================== */}
      <section className="py-20 bg-gradient-to-r from-indigo-700 via-indigo-800 to-violet-800 text-white relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8 relative z-10">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
            ¿Listo para llevar la administración de tu empresa al siguiente nivel?
          </h2>
          <p className="text-lg text-indigo-100 max-w-2xl mx-auto">
            Únete a cientos de emprendedores que ya ahorran horas de trabajo al día con PymeWeb ERP.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/registro"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-black text-base bg-white text-indigo-900 hover:bg-indigo-50 transition shadow-xl"
            >
              <span>Crear Cuenta Gratis ({subData.dias_prueba} Días)</span>
              <ArrowRight className="w-5 h-5 text-indigo-600" />
            </Link>

            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl font-bold text-base bg-indigo-900/60 hover:bg-indigo-900 text-white border border-indigo-400/30 transition"
            >
              <LogIn className="w-5 h-5" />
              <span>Ya tengo cuenta • Iniciar Sesión</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer className="py-12 bg-slate-900 text-slate-400 text-xs border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold">
                <Store className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-xl text-white">PymeWeb ERP</span>
              <span className="text-[11px] text-slate-500 font-mono">v2.5 Ecuador</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-300">
              <Link href="/login" className="hover:text-white transition">
                Acceso Plataforma
              </Link>
              <Link href="/registro" className="hover:text-white transition">
                Registro ({subData.dias_prueba} Días Gratis)
              </Link>
              <a href="#planes" className="hover:text-white transition">
                Planes y Precios
              </a>
              <a href="#transferencia" className="hover:text-white transition">
                Transferencia Bancaria
              </a>
              <a href={whatsappUrl} target="_blank" rel="noreferrer" className="hover:text-emerald-400 transition flex items-center gap-1">
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp Soporte</span>
              </a>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500">
            <p>
              © {new Date().getFullYear()} PymeWeb ERP S.A.S. Todos los derechos reservados.
            </p>
            <p>
              Facturación Electrónica SRI • POS • Tienda Virtual • Logística • Contabilidad
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
