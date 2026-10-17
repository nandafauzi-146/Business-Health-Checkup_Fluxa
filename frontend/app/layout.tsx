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
  title: "Fluxa \u2014 Kasir & Diagnosis Kesehatan Bisnis UMKM",
  description: "Sistem kasir (POS) terintegrasi dengan diagnosis kesehatan bisnis berbasis AI untuk UMKM. Setiap transaksi otomatis membentuk rapor finansial yang actionable.",
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
              if (preference !== 'light' && preference !== 'dark' && preference !== 'system') preference = 'system';
              var dark = preference === 'dark' || (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
              document.documentElement.dataset.themePreference = preference;
              document.documentElement.dataset.theme = dark ? 'dark' : 'light';
              document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
            } catch (_) {
              document.documentElement.dataset.themePreference = 'system';
              document.documentElement.dataset.theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
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
