import type { Metadata, Viewport } from "next";
import { SerwistProvider } from "@serwist/turbopack/react";
import AvisoConexion from "@/components/pwa/AvisoConexion";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Tipografía única de Orbit en toda la app (fuente variable: todos los pesos en un archivo).
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: "Orbit",
  title: "ORBIT — Tu tiempo en órbita",
  description: "Organizador académico inteligente",
  // Instalada en iPhone: abre a pantalla completa con el nombre corto (el manifiesto está en app/manifest.ts)
  appleWebApp: { capable: true, title: "Orbit", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { themeColor: "#35695D" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* PWA: el service worker (/serwist/sw.js) solo corre en producción; en desarrollo no guarda nada */}
        <SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV === "development"} cacheOnNavigation reloadOnOnline={false}>
          {children}
          <AvisoConexion />
        </SerwistProvider>
      </body>
    </html>
  );
}
