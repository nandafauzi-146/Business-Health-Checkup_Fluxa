import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Masuk | Fluxa",
  description: "Masuk ke Fluxa untuk mengelola operasional bisnis Anda.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
