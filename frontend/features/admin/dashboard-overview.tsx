import Link from "next/link";
import AppShell from "@/components/layout/app-shell";
import type { Database, UserRole } from "@/lib/supabase/types";

type DashboardSale = Pick<
  Database["public"]["Tables"]["sales"]["Row"],
  "id" | "invoice_number" | "final_amount" | "payment_status" | "status" | "created_at"
>;

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const dateLabel = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  dateStyle: "full",
});

const timeLabel = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
});

export default function DashboardOverview({
  fullName,
  role,
  sales,
}: {
  fullName: string;
  role: UserRole;
  sales: DashboardSale[];
}) {
  const successfulSales = sales.filter((sale) => sale.status === "completed");
  const revenue = successfulSales.reduce((sum, sale) => sum + sale.final_amount, 0);
  const pendingPayments = sales.filter((sale) => sale.status === "completed" && sale.payment_status !== "paid").length;
  const greetingName = fullName.trim().split(/\s+/)[0] || "Pengguna";

  return (
    <AppShell adminName={fullName} role={role} pageTitle="Dashboard">
      <section className="dashboard-page">
        <div className="dashboard-heading">
          <div>
            <div className="transaction-eyebrow">RINGKASAN <span>/</span> HARI INI</div>
            <h1>Selamat datang, {greetingName} <span aria-hidden="true">👋</span></h1>
            <p>Ini ringkasan aktivitas tokomu untuk hari ini.</p>
          </div>
          <div className="dashboard-date">{dateLabel.format(new Date())}</div>
        </div>

        <div className="dashboard-stats">
          <article className="dashboard-stat-card">
            <span className="dashboard-stat-icon stat-purple">↗</span>
            <span className="dashboard-stat-label">Penjualan hari ini</span>
            <strong>{rupiah.format(revenue)}</strong>
            <small>Total transaksi berhasil</small>
          </article>
          <article className="dashboard-stat-card">
            <span className="dashboard-stat-icon stat-green">▤</span>
            <span className="dashboard-stat-label">Transaksi hari ini</span>
            <strong>{successfulSales.length.toLocaleString("id-ID")}</strong>
            <small>Transaksi selesai</small>
          </article>
          <article className="dashboard-stat-card">
            <span className="dashboard-stat-icon stat-amber">◷</span>
            <span className="dashboard-stat-label">Menunggu pembayaran</span>
            <strong>{pendingPayments.toLocaleString("id-ID")}</strong>
            <small>Perlu ditindaklanjuti</small>
          </article>
        </div>

        <section className="dashboard-panel">
          <div className="dashboard-panel-heading">
            <div><h2>Transaksi terbaru</h2><p>Aktivitas penjualan yang tercatat hari ini.</p></div>
            {role !== "kasir" && <Link href="/admin/transactions">Lihat semua transaksi <span aria-hidden="true">→</span></Link>}
          </div>
          {sales.length ? (
            <div className="dashboard-recent-list">
              {sales.slice(0, 5).map((sale) => (
                <div className="dashboard-recent-row" key={sale.id}>
                  <span className={`dashboard-recent-icon ${sale.status === "voided" ? "is-voided" : ""}`}>{sale.status === "voided" ? "×" : "✓"}</span>
                  <span className="dashboard-recent-main"><strong>{sale.invoice_number}</strong><small>{timeLabel.format(new Date(sale.created_at))} WIB</small></span>
                  <span className="dashboard-recent-status">{sale.status === "voided" ? "Dibatalkan" : sale.payment_status === "paid" ? "Lunas" : "Belum lunas"}</span>
                  <strong className="dashboard-recent-amount">{rupiah.format(sale.final_amount)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="dashboard-empty">
              <span aria-hidden="true">▤</span>
              <strong>Belum ada transaksi hari ini</strong>
              <p>Aktivitas penjualan akan muncul di sini setelah transaksi tercatat.</p>
            </div>
          )}
        </section>
        <p className="dashboard-updated">Ringkasan diperbarui saat halaman dibuka · {timeLabel.format(new Date())} WIB</p>
      </section>
    </AppShell>
  );
}
