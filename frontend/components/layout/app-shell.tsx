"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/supabase/types";

type AppShellProps = {
  adminName: string;
  role: UserRole;
  pageTitle: string;
  children: ReactNode;
};

export default function AppShell({ adminName, role, pageTitle, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const canViewTransactions = role === "admin" || role === "owner";
  const sidebarExpanded = sidebarPinned || sidebarHovered;

  async function handleSignOut() {
    setIsSigningOut(true);
    setSignOutError("");

    try {
      const { error } = await createClient().auth.signOut();

      if (error) {
        setSignOutError("Tidak dapat keluar saat ini. Silakan coba lagi.");
        setIsSigningOut(false);
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setSignOutError("Tidak dapat keluar saat ini. Silakan coba lagi.");
      setIsSigningOut(false);
    }
  }

  return (
    <main className={`transaction-app${sidebarExpanded ? " transaction-sidebar-open" : " transaction-sidebar-collapsed"}${sidebarPinned ? " transaction-sidebar-pinned" : ""}`}>
      <aside
        className="transaction-sidebar"
        aria-label="Sidebar navigasi"
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
        onTouchStart={() => setSidebarPinned(true)}
      >
        <Link className="transaction-brand" href="/dashboard" aria-label="Fluxa, dashboard">
          <span className="transaction-brand-mark">F</span>
          <span>fluxa<span className="transaction-brand-dot">.</span></span>
        </Link>
        <p className="transaction-nav-label">MENU UTAMA</p>
        <nav className="transaction-nav" aria-label="Navigasi utama">
          <Link className={pathname === "/dashboard" ? "is-active" : ""} href="/dashboard" aria-current={pathname === "/dashboard" ? "page" : undefined}>
            <AppIcon name="grid" />Dashboard
          </Link>
          <Link className={pathname.startsWith("/cashier") ? "is-active" : ""} href="/cashier" aria-current={pathname.startsWith("/cashier") ? "page" : undefined}>
            <AppIcon name="cashier" />Kasir
          </Link>
          {canViewTransactions && (
            <Link className={pathname.startsWith("/admin/transactions") ? "is-active" : ""} href="/admin/transactions" aria-current={pathname.startsWith("/admin/transactions") ? "page" : undefined}>
              <AppIcon name="receipt" />Transaksi
            </Link>
          )}
        </nav>
        <div className="transaction-sidebar-bottom">
          <div className="transaction-profile">
            <span className="transaction-profile-avatar">{adminName.slice(0, 1).toUpperCase()}</span>
            <span><strong>{adminName}</strong><small>{role === "owner" ? "Owner" : role === "admin" ? "Administrator" : "Kasir"}</small></span>
          </div>
          <button className="transaction-signout" type="button" onClick={handleSignOut} disabled={isSigningOut}>
            {isSigningOut ? "Sedang keluar..." : "Keluar"}
          </button>
          {signOutError && <p className="transaction-signout-error" role="alert">{signOutError}</p>}
        </div>
      </aside>

      <section className="transaction-main">
        <header className="transaction-topbar">
          <div className="transaction-topbar-leading">
            <button
              className="transaction-sidebar-toggle"
              type="button"
              aria-label={sidebarPinned ? "Ciutkan sidebar" : "Tampilkan menu lengkap"}
              aria-expanded={sidebarExpanded}
              onClick={() => {
                setSidebarHovered(false);
                setSidebarPinned((pinned) => !pinned);
              }}
            >
              <AppIcon name={sidebarPinned ? "panelClose" : "panelOpen"} />
            </button>
            <div className="transaction-breadcrumb"><strong>{pageTitle}</strong></div>
          </div>
        </header>
        <div className="transaction-content">{children}</div>
      </section>
    </main>
  );
}

function AppIcon({ name }: { name: "grid" | "receipt" | "cashier" | "panelClose" | "panelOpen" }) {
  const paths = {
    grid: <><rect x="3.5" y="3.5" width="6" height="6" rx="1" /><rect x="14.5" y="3.5" width="6" height="6" rx="1" /><rect x="3.5" y="14.5" width="6" height="6" rx="1" /><rect x="14.5" y="14.5" width="6" height="6" rx="1" /></>,
    receipt: <><path d="M5 3.5h14v17l-3-2-4 2-4-2-3 2z" /><path d="M8 8h8M8 12h8" /></>,
    cashier: <><path d="M4 5h16v15H4z" /><path d="M8 2v6m8-6v6M8 12h8m-8 4h5" /></>,
    panelClose: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M14 9l-3 3 3 3" /></>,
    panelOpen: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M14 9l3 3-3 3" /></>,
  };

  return <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
