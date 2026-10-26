import StorefrontClient from "./StorefrontClient";
import { Store, AlertOctagon } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost/pymeweb/backend-api/api";

async function getStoreData(slug: string) {
  const res = await fetch(
    `${API_BASE}/storefront/catalog.php?slug=${encodeURIComponent(slug)}`,
    { cache: "no-store" }
  );
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

export default async function StorefrontPage({
  params,
}: {
  params: Promise<{ "nombre-negocio": string }>;
}) {
  const resolvedParams = await params;
  const slug = resolvedParams["nombre-negocio"];
  const { status, data } = await getStoreData(slug);

  if (status === 404) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-6">
        <div className="max-w-md text-center space-y-3">
          <Store className="w-12 h-12 mx-auto text-slate-400" />
          <h1 className="text-2xl font-bold">Tienda no encontrada</h1>
          <p className="text-sm text-slate-500">
            Verifica que la dirección web del negocio esté bien escrita.
          </p>
        </div>
      </div>
    );
  }

  if (status === 403 || data?.available === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
            <AlertOctagon className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold">
            Tienda temporalmente fuera de servicio
          </h1>
          {data?.negocio_nombre && (
            <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
              {data.negocio_nombre}
            </p>
          )}
          <p className="text-sm text-slate-500 dark:text-slate-400">
            El catálogo en línea de este comercio no se encuentra disponible en este momento. Por favor intenta nuevamente más tarde.
          </p>
        </div>
      </div>
    );
  }

  return (
    <StorefrontClient
      store={data.store}
      initialProducts={data.products || []}
      initialCategories={data.categories || []}
    />
  );
}
