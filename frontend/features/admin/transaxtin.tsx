"use client";

import { useMemo, useState, type ReactNode } from "react";
import AppShell from "@/components/layout/app-shell";
import type { UserRole } from "@/lib/supabase/types";

export type Transaction = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  cashierName: string;
  totalAmount: number;
  finalAmount: number;
  paymentMethod: "cash" | "qris" | "transfer" | "credit";
  paymentStatus: "paid" | "unpaid" | "partial";
  status: "completed" | "voided";
  createdAt: string;
};

type IconName = "grid" | "receipt" | "box" | "users" | "store" | "wallet" | "chart" | "tag" | "settings" | "search" | "calendar" | "filter" | "check" | "clock" | "x" | "chevron" | "dots" | "arrow" | "close";

const paymentLabels: Record<Transaction["paymentMethod"], string> = {
  cash: "Tunai",
  qris: "QRIS",
  transfer: "Transfer",
  credit: "Kredit",
};

const paymentStatusLabels: Record<Transaction["paymentStatus"], string> = {
  paid: "Lunas",
  unpaid: "Belum lunas",
  partial: "Sebagian",
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const icons: Record<IconName, ReactNode> = {
    grid: <><rect x="3.5" y="3.5" width="6" height="6" rx="1" /><rect x="14.5" y="3.5" width="6" height="6" rx="1" /><rect x="3.5" y="14.5" width="6" height="6" rx="1" /><rect x="14.5" y="14.5" width="6" height="6" rx="1" /></>,
    receipt: <><path d="M5 3.5h14v17l-3-2-4 2-4-2-3 2z" /><path d="M8 8h8M8 12h8" /></>,
    box: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 8 9 5 9-5M3 8v9l9 5 9-5V8M12 13v9" /></>,
    users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 5.2a3.5 3.5 0 0 1 0 6.6M18 14a5.5 5.5 0 0 1 3.5 5" /></>,
    store: <><path d="M4 10v10h16V10M3 4h18l1 5a3 3 0 0 1-5 2.2A3 3 0 0 1 12 11a3 3 0 0 1-5 0A3 3 0 0 1 2 9z" /><path d="M9 20v-5h6v5" /></>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 9h18M16 14h2" /></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    tag: <><path d="M20.5 13 13 20.5 3.5 11V3.5H11z" /><circle cx="8" cy="8" r="1" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.6.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.6-.9l-1.7.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.9l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.6-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.6.9l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.9Z" transform="translate(-1 -1)" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M7.5 3v4M16.5 3v4M3.5 10h17" /></>,
    filter: <path d="M3 5h18l-7 8v5l-4 2v-7z" />,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    x: <><circle cx="12" cy="12" r="9" /><path d="m8.5 8.5 7 7m0-7-7 7" /></>,
    chevron: <path d="m8 10 4 4 4-4" />,
    dots: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
  };

  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{icons[name]}</svg>;
}

function getJakartaDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function TransactionHistory({ transactions, adminName, role }: { transactions: Transaction[]; adminName: string; role: UserRole }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [payment, setPayment] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const pageSize = 8;

  const filteredTransactions = useMemo(() => transactions.filter((transaction) => {
    const query = search.trim().toLocaleLowerCase("id-ID");
    const matchesSearch = !query
      || transaction.invoiceNumber.toLocaleLowerCase("id-ID").includes(query)
      || transaction.customerName.toLocaleLowerCase("id-ID").includes(query)
      || transaction.cashierName.toLocaleLowerCase("id-ID").includes(query);
    const transactionDate = getJakartaDate(transaction.createdAt);

    return matchesSearch
      && (status === "all" || (status === "pending"
        ? transaction.paymentStatus !== "paid" && transaction.status !== "voided"
        : transaction.status === status))
      && (payment === "all" || transaction.paymentMethod === payment)
      && (!dateFrom || transactionDate >= dateFrom)
      && (!dateTo || transactionDate <= dateTo);
  }), [dateFrom, dateTo, payment, search, status, transactions]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const visibleTransactions = filteredTransactions.slice((page - 1) * pageSize, page * pageSize);
  const completedCount = transactions.filter((transaction) => transaction.status === "completed").length;
  const pendingCount = transactions.filter((transaction) => transaction.status === "completed" && transaction.paymentStatus !== "paid").length;
  const voidedCount = transactions.filter((transaction) => transaction.status === "voided").length;

  function updateFilter(update: () => void) {
    update();
    setPage(1);
  }

  return (
    <AppShell adminName={adminName} role={role} pageTitle="Transaksi">
          <div className="transaction-heading-row">
            <div><div className="transaction-eyebrow">OPERASIONAL <span>/</span> PENJUALAN</div><h1>Riwayat transaksi</h1><p>Pantau dan kelola seluruh transaksi tokomu dalam satu tempat.</p></div>
            <button className="transaction-export" type="button" onClick={() => window.print()}><Icon name="arrow" size={16} />Cetak laporan</button>
          </div>
          <div className="transaction-stats" aria-label="Ringkasan transaksi">
            <article className="transaction-stat-card"><span className="transaction-stat-icon stat-purple"><Icon name="receipt" size={19} /></span><div><span>Total transaksi</span><strong>{transactions.length.toLocaleString("id-ID")}</strong></div><span className="transaction-stat-meta">Semua waktu</span></article>
            <article className="transaction-stat-card"><span className="transaction-stat-icon stat-green"><Icon name="check" size={19} /></span><div><span>Berhasil</span><strong>{completedCount.toLocaleString("id-ID")}</strong></div><span className="transaction-stat-meta">Transaksi tercatat</span></article>
            <article className="transaction-stat-card"><span className="transaction-stat-icon stat-amber"><Icon name="clock" size={19} /></span><div><span>Menunggu pembayaran</span><strong>{pendingCount.toLocaleString("id-ID")}</strong></div><span className="transaction-stat-meta">Belum lunas</span></article>
            <article className="transaction-stat-card"><span className="transaction-stat-icon stat-red"><Icon name="x" size={19} /></span><div><span>Dibatalkan</span><strong>{voidedCount.toLocaleString("id-ID")}</strong></div><span className="transaction-stat-meta">Transaksi void</span></article>
          </div>

          <section className="transaction-panel" aria-labelledby="transaction-list-title">
            <div className="transaction-panel-heading"><div><h2 id="transaction-list-title">Semua transaksi</h2><p>Daftar transaksi terbaru yang tercatat di tokomu.</p></div><span className="transaction-record-count">{filteredTransactions.length.toLocaleString("id-ID")} transaksi</span></div>
            <div className="transaction-filters">
              <label className="transaction-date-filter"><Icon name="calendar" size={16} /><input aria-label="Tanggal mulai" type="date" value={dateFrom} onChange={(event) => updateFilter(() => setDateFrom(event.target.value))} /></label>
              <span className="transaction-date-separator">sampai</span>
              <label className="transaction-date-filter"><Icon name="calendar" size={16} /><input aria-label="Tanggal akhir" type="date" value={dateTo} onChange={(event) => updateFilter(() => setDateTo(event.target.value))} /></label>
              <label className="transaction-select-wrap"><select aria-label="Filter status" value={status} onChange={(event) => updateFilter(() => setStatus(event.target.value))}><option value="all">Semua status</option><option value="completed">Berhasil</option><option value="pending">Menunggu pembayaran</option><option value="voided">Dibatalkan</option></select><Icon name="chevron" size={15} /></label>
              <label className="transaction-select-wrap"><select aria-label="Filter pembayaran" value={payment} onChange={(event) => updateFilter(() => setPayment(event.target.value))}><option value="all">Semua pembayaran</option><option value="cash">Tunai</option><option value="qris">QRIS</option><option value="transfer">Transfer</option><option value="credit">Kredit</option></select><Icon name="chevron" size={15} /></label>
              <label className="transaction-search"><Icon name="search" size={17} /><input aria-label="Cari transaksi" type="search" placeholder="Cari transaksi..." value={search} onChange={(event) => updateFilter(() => setSearch(event.target.value))} /></label>
              <button className="transaction-filter-button" type="button" onClick={() => updateFilter(() => { setDateFrom(""); setDateTo(""); setStatus("all"); setPayment("all"); setSearch(""); })}><Icon name="filter" size={16} /><span>Reset</span></button>
            </div>

            <div className="transaction-table-wrap">
              <table className="transaction-table">
                <thead><tr><th>Transaksi</th><th>Tanggal &amp; waktu</th><th>Pelanggan</th><th>Metode bayar</th><th>Total</th><th>Status</th><th><span className="sr-only">Aksi</span></th></tr></thead>
                <tbody>
                  {visibleTransactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td><span className="transaction-invoice">{transaction.invoiceNumber}</span><span className="transaction-cashier">Kasir: {transaction.cashierName}</span></td>
                      <td><span className="transaction-date-value">{formatDate(transaction.createdAt)}</span></td>
                      <td><span className="transaction-customer">{transaction.customerName}</span></td>
                      <td><span className="transaction-payment"><span className={`transaction-payment-icon payment-${transaction.paymentMethod}`}>{transaction.paymentMethod === "cash" ? "Rp" : transaction.paymentMethod === "qris" ? "Q" : transaction.paymentMethod === "credit" ? "K" : "↗"}</span>{paymentLabels[transaction.paymentMethod]}</span></td>
                      <td><span className="transaction-amount">{formatRupiah(transaction.finalAmount)}</span></td>
                      <td><span className={`transaction-status ${transaction.status === "voided" ? "status-voided" : transaction.paymentStatus === "paid" ? "status-paid" : "status-pending"}`}><span />{transaction.status === "voided" ? "Dibatalkan" : paymentStatusLabels[transaction.paymentStatus]}</span></td>
                      <td><button className="transaction-row-action" type="button" aria-label={`Lihat transaksi ${transaction.invoiceNumber}`} onClick={() => setSelectedTransaction(transaction)}><Icon name="dots" size={19} /></button></td>
                    </tr>
                  ))}
                  {visibleTransactions.length === 0 && <tr><td className="transaction-empty" colSpan={7}><span className="transaction-empty-icon"><Icon name="search" size={21} /></span><strong>Transaksi tidak ditemukan</strong><span>Coba ubah kata kunci atau filter yang kamu gunakan.</span></td></tr>}
                </tbody>
              </table>
            </div>
            <footer className="transaction-pagination">
              <span>Menampilkan <strong>{filteredTransactions.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filteredTransactions.length)}</strong> dari <strong>{filteredTransactions.length}</strong> transaksi</span>
              <div><button type="button" aria-label="Halaman sebelumnya" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}><Icon name="chevron" size={16} /></button><span>Halaman <strong>{page}</strong> dari <strong>{totalPages}</strong></span><button type="button" aria-label="Halaman berikutnya" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}><Icon name="chevron" size={16} /></button></div>
            </footer>
          </section>
          <p className="transaction-footnote"><span />Data transaksi tersimpan aman dan hanya dapat diakses oleh staf berwenang.</p>

      {selectedTransaction && <div className="transaction-modal-backdrop" onClick={() => setSelectedTransaction(null)}><section className="transaction-modal" role="dialog" aria-modal="true" aria-labelledby="transaction-detail-title" onClick={(event) => event.stopPropagation()}>
        <div className="transaction-modal-heading"><div><span className="transaction-eyebrow">DETAIL TRANSAKSI</span><h2 id="transaction-detail-title">{selectedTransaction.invoiceNumber}</h2></div><button type="button" aria-label="Tutup detail transaksi" onClick={() => setSelectedTransaction(null)}><Icon name="close" /></button></div>
        <dl className="transaction-detail-list">
          <div><dt>Tanggal</dt><dd>{formatDate(selectedTransaction.createdAt)}</dd></div><div><dt>Pelanggan</dt><dd>{selectedTransaction.customerName}</dd></div><div><dt>Kasir</dt><dd>{selectedTransaction.cashierName}</dd></div><div><dt>Metode pembayaran</dt><dd>{paymentLabels[selectedTransaction.paymentMethod]}</dd></div><div><dt>Status pembayaran</dt><dd>{selectedTransaction.status === "voided" ? "Dibatalkan" : paymentStatusLabels[selectedTransaction.paymentStatus]}</dd></div><div><dt>Total sebelum diskon</dt><dd>{formatRupiah(selectedTransaction.totalAmount)}</dd></div><div className="transaction-detail-total"><dt>Total transaksi</dt><dd>{formatRupiah(selectedTransaction.finalAmount)}</dd></div>
        </dl>
      </section></div>}
    </AppShell>
  );
}