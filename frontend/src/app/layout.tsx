import "./globals.css";
import { ReactNode } from "react";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata = {
  title: "PymeWeb SaaS - Punto de Venta, Inventario y Tienda Online",
  description: "Plataforma multi-inquilino para negocios pequeños",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
