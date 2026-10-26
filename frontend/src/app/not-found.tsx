import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-center">
      <h1 className="text-6xl font-black text-indigo-600 mb-2">404</h1>
      <h2 className="text-2xl font-bold mb-4">Página no encontrada</h2>
      <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6 text-sm">
        Lo sentimos, la página o tienda que estás buscando no existe o fue movida.
      </p>
      <Link
        href="/"
        className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition"
      >
        Volver al Inicio
      </Link>
    </div>
  );
}
