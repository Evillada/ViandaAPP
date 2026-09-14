import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/shared/lib/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Vianda — Nutrición clínica",
  description: "Plataforma de gestión nutricional clínica para profesionales",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
