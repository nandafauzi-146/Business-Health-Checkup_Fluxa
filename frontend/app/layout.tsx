import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Fluxa — Kasir & Diagnosis Kesehatan Bisnis UMKM",
  description: "Sistem kasir (POS) terintegrasi dengan diagnosis kesehatan bisnis berbasis AI untuk UMKM. Setiap transaksi otomatis membentuk rapor finansial yang actionable.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={inter.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
