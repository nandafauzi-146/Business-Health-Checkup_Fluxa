"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/supabase/types";

const roleLabels: Record<UserRole, string> = {
  kasir: "Kasir",
  admin: "Admin",
  owner: "Owner",
};

type SignedInPanelProps = {
  email: string;
  fullName: string | null;
  role: UserRole | null;
};

export default function SignedInPanel({ email, fullName, role }: SignedInPanelProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSignOut() {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        setErrorMessage("Tidak dapat keluar saat ini. Silakan coba lagi.");
        setIsLoading(false);
        return;
      }

      router.refresh();
    } catch {
      setErrorMessage("Tidak dapat keluar saat ini. Silakan coba lagi.");
      setIsLoading(false);
    }
  }

  return (
    <section className="auth-panel" aria-labelledby="signed-in-heading">
      <div className="auth-brand" aria-label="Fluxa">
        <span className="auth-brand-mark" aria-hidden="true">F</span>
        <span>Fluxa</span>
      </div>
      <h1 className="auth-heading" id="signed-in-heading">Anda sudah masuk</h1>
      <p className="auth-description">
        {fullName ? `Selamat datang, ${fullName}.` : "Sesi akun Anda sedang aktif."}
        <br />
        {email}
      </p>
      {role && <span className="auth-role">{roleLabels[role]}</span>}
      {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}
      {(role === "admin" || role === "owner") && (
        <Link className="auth-button auth-button-dashboard" href="/admin/transactions">
          Buka riwayat transaksi
        </Link>
      )}
      <button
        className="auth-button auth-button-secondary"
        type="button"
        onClick={handleSignOut}
        disabled={isLoading}
      >
        {isLoading ? "Keluar..." : "Keluar dari akun"}
      </button>
    </section>
  );
}