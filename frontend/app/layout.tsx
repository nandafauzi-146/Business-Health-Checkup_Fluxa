import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import Script from "next/script";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Fluxa — Kasir & Diagnosis Kesehatan Bisnis UMKM",
  description: "Sistem kasir (POS) terintegrasi dengan diagnosis kesehatan bisnis berbasis AI untuk UMKM. Setiap transaksi otomatis membentuk rapor finansial yang actionable.",
  icons: {
    icon: "/Fluxa-Logo.webp",
    apple: "/Fluxa-Logo.webp",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={inter.variable} suppressHydrationWarning>
      <head>
        <Script
          id="fluxa-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `try {
              var accountId = localStorage.getItem('fluxa-theme-active-user');
              var preference = accountId ? localStorage.getItem('fluxa-theme:' + accountId) : null;
              if (!preference) preference = localStorage.getItem('fluxa-theme');
              if (preference !== 'light' && preference !== 'dark') preference = 'dark';
              var dark = preference === 'dark';
              document.documentElement.dataset.themePreference = preference;
              document.documentElement.dataset.theme = dark ? 'dark' : 'light';
              document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
            } catch (_) {
              document.documentElement.dataset.themePreference = 'dark';
              document.documentElement.dataset.theme = 'dark';
              document.documentElement.style.colorScheme = 'dark';
            }`,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
