const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost/pymeweb/backend-api/api";

export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("pymeweb_token") : null;
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 403 && data?.code === "SUBSCRIPTION_EXPIRED") {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "pymeweb_expired_info",
        JSON.stringify({
          negocio_nombre: data.negocio_nombre,
          fecha_expiracion: data.fecha_expiracion,
        })
      );
      window.location.href = "/suscripcion-expirada";
    }
    throw new Error(data.message || "Suscripción expirada");
  }

  if (!res.ok) {
    throw new Error(data.error || "Ocurrió un error en la solicitud");
  }

  return data as T;
}
