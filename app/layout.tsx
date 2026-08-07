import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mi Boliche",
  description: "Gestión simple para tu negocio",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
