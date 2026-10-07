"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type CashierProduct = {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  stock: number;
  unit: string;
  category: string;
};

export type CashierCustomer = {
  id: string;
  name: string;
  phone: string | null;
};

type CashierShift = {
  id: string;
  opened_at: string;
  initial_cash: number;
};

type CartLine = {
  product: CashierProduct;
  quantity: number;
};

const formatRupiah = (amount: number) => new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
}).format(amount);

const paymentOptions = [
  { id: "cash", label: "Tunai", mark: "Rp" },
  { id: "qris", label: "QRIS", mark: "Q" },
  { id: "transfer", label: "Transfer", mark: "↗" },
  { id: "credit", label: "Kasbon", mark: "K" },
] as const;

export default function CashierRegister({
  products,
  customers,
  activeShift,
}: {
  products: CashierProduct[];
  customers: CashierCustomer[];
  activeShift: CashierShift | null;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Semua");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<(typeof paymentOptions)[number]["id"]>("cash");
  const [initialCash, setInitialCash] = useState("");
  const [isOpeningShift, setIsOpeningShift] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const categories = useMemo(
    () => ["Semua", ...new Set(products.map((product) => product.category))],
    [products],
  );
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id-ID");
    return products.filter((product) => (
      (selectedCategory === "Semua" || product.category === selectedCategory)
      && (!query
        || product.name.toLocaleLowerCase("id-ID").includes(query)
        || (product.sku ?? "").toLocaleLowerCase("id-ID").includes(query))
    ));
  }, [products, search, selectedCategory]);
  const totalItems = cart.reduce((total, line) => total + line.quantity, 0);
  const totalAmount = cart.reduce((total, line) => total + line.quantity * line.product.price, 0);
  const selectedCustomer = customers.find((customer) => customer.id === customerId);

  function addProduct(product: CashierProduct) {
    setErrorMessage("");
    setSuccessMessage("");
    setCart((currentCart) => {
      const existingLine = currentCart.find((line) => line.product.id === product.id);
      if (existingLine && existingLine.quantity >= product.stock) {
        setErrorMessage(`Stok ${product.name} hanya tersisa ${product.stock}.`);
        return currentCart;
      }
      if (!existingLine && product.stock < 1) {
        setErrorMessage(`${product.name} sedang habis.`);
        return currentCart;
      }
      return existingLine
        ? currentCart.map((line) => line.product.id === product.id
          ? { ...line, quantity: line.quantity + 1 }
          : line)
        : [...currentCart, { product, quantity: 1 }];
    });
  }

  function changeQuantity(productId: string, delta: number) {
    setCart((currentCart) => currentCart.flatMap((line) => {
      if (line.product.id !== productId) return [line];
      const quantity = line.quantity + delta;
      if (quantity < 1) return [];
      if (quantity > line.product.stock) {
        setErrorMessage(`Stok ${line.product.name} hanya tersisa ${line.product.stock}.`);
        return [line];
      }
      return [{ ...line, quantity }];
    }));
  }

  async function openShift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsOpeningShift(true);
    const amount = Number(initialCash);

    try {
      const { error } = await createClient().rpc("open_shift", {
        p_initial_cash: amount,
        p_note: null,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setInitialCash("");
      router.refresh();
    } catch {
      setErrorMessage("Shift belum berhasil dibuka. Periksa koneksi lalu coba lagi.");
    } finally {
      setIsOpeningShift(false);
    }
  }

  async function checkout() {
    if (!activeShift || cart.length === 0) return;
    if (paymentMethod === "credit" && !customerId) {
      setErrorMessage("Pilih pelanggan untuk transaksi kasbon.");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsCheckingOut(true);

    try {
      const supabase = createClient();
      const { data: saleId, error } = await supabase.rpc("create_sale", {
        p_shift_id: activeShift.id,
        p_customer_id: customerId || null,
        p_payment_method: paymentMethod,
        p_discount: 0,
        p_items: cart.map(({ product, quantity }) => ({
          product_id: product.id,
          quantity,
        })),
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }
      if (!saleId) {
        setErrorMessage("Transaksi tidak menghasilkan nomor penjualan. Silakan periksa riwayat transaksi.");
        return;
      }

      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .select("invoice_number")
        .eq("id", saleId)
        .maybeSingle();

      if (saleError) {
        setErrorMessage(`Transaksi tersimpan, tetapi nomor invoice tidak dapat dimuat: ${saleError.message}`);
      } else {
        setSuccessMessage(`Transaksi berhasil${sale?.invoice_number ? ` · ${sale.invoice_number}` : ""}.`);
      }
      setCart([]);
      setCustomerId("");
      router.refresh();
    } catch {
      setErrorMessage("Transaksi belum berhasil. Periksa koneksi lalu coba lagi.");
    } finally {
      setIsCheckingOut(false);
    }
  }

  if (!activeShift) {
    return (
      <section className="cashier-shift-page">
        <div className="cashier-page-heading">
          <div><span className="transaction-eyebrow">OPERASIONAL <span>/</span> KASIR</span><h1>Buka shift kasir</h1><p>Masukkan saldo awal kas untuk memulai transaksi.</p></div>
        </div>
        <form className="cashier-shift-card" onSubmit={openShift}>
          <span className="cashier-shift-icon">◷</span>
          <h2>Mulai shift baru</h2>
          <p>Saldo awal akan digunakan untuk menghitung kas yang diharapkan saat shift ditutup.</p>
          <label className="cashier-field">
            <span>Saldo awal kas</span>
            <div className="cashier-money-input"><span>Rp</span><input type="number" min="0" step="1" inputMode="numeric" placeholder="0" value={initialCash} onChange={(event) => setInitialCash(event.target.value)} required /></div>
          </label>
          {errorMessage && <p className="cashier-alert cashier-alert-error" role="alert">{errorMessage}</p>}
          <button className="cashier-primary-button" type="submit" disabled={isOpeningShift}>{isOpeningShift ? "Membuka shift..." : "Buka shift"}</button>
        </form>
      </section>
    );
  }

  return (
    <section className="cashier-page">
      <div className="cashier-page-heading">
        <div><span className="transaction-eyebrow">OPERASIONAL <span>/</span> KASIR</span><h1>Transaksi baru</h1><p>Pilih produk untuk menambahkannya ke keranjang.</p></div>
        <div className="cashier-shift-status"><span />Shift aktif sejak {new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }).format(new Date(activeShift.opened_at))} WIB</div>
      </div>

      <div className="cashier-workspace">
        <section className="cashier-catalog" aria-labelledby="cashier-catalog-title">
          <div className="cashier-catalog-heading"><div><h2 id="cashier-catalog-title">Pilih produk</h2><span>{filteredProducts.length} produk tersedia</span></div></div>
          <label className="cashier-search"><CashierIcon name="search" /><input type="search" aria-label="Cari produk" placeholder="Cari nama atau SKU produk..." value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>/</kbd></label>
          <div className="cashier-categories" aria-label="Filter kategori">
            {categories.map((category) => <button type="button" key={category} className={category === selectedCategory ? "is-selected" : ""} onClick={() => setSelectedCategory(category)}>{category}</button>)}
          </div>
          <div className="cashier-product-grid">
            {filteredProducts.map((product) => {
              const isOutOfStock = product.stock < 1;
              return (
                <button className="cashier-product-card" type="button" key={product.id} disabled={isOutOfStock} onClick={() => addProduct(product)}>
                  <span className="cashier-product-art"><CashierIcon name="box" /></span>
                  <span className="cashier-product-name">{product.name}</span>
                  <span className="cashier-product-sku">{product.sku ?? product.category}</span>
                  <span className="cashier-product-card-bottom"><strong>{formatRupiah(product.price)}</strong><small className={isOutOfStock ? "is-out" : ""}>{isOutOfStock ? "Habis" : `Stok ${product.stock}`}</small></span>
                </button>
              );
            })}
            {filteredProducts.length === 0 && <div className="cashier-no-products"><strong>Produk tidak ditemukan</strong><span>Coba kata kunci atau kategori lain.</span></div>}
          </div>
        </section>

        <aside className="cashier-cart" aria-label="Keranjang transaksi">
          <div className="cashier-cart-heading"><div><h2>Keranjang</h2><span>{totalItems} item</span></div><button type="button" disabled={!cart.length} onClick={() => { setCart([]); setErrorMessage(""); }}>Kosongkan</button></div>
          <label className="cashier-field cashier-customer-field"><span>Pelanggan <small>(opsional)</small></span><select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Pelanggan umum</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ""}</option>)}</select></label>
          <div className="cashier-cart-lines">
            {cart.map(({ product, quantity }) => (
              <article className="cashier-cart-line" key={product.id}>
                <span className="cashier-cart-product-icon"><CashierIcon name="box" /></span>
                <div className="cashier-cart-product"><strong>{product.name}</strong><span>{formatRupiah(product.price)}</span></div>
                <div className="cashier-quantity-control"><button type="button" aria-label={`Kurangi ${product.name}`} onClick={() => changeQuantity(product.id, -1)}>−</button><span>{quantity}</span><button type="button" aria-label={`Tambah ${product.name}`} onClick={() => changeQuantity(product.id, 1)}>+</button></div>
              </article>
            ))}
            {cart.length === 0 && <div className="cashier-cart-empty"><span><CashierIcon name="cart" /></span><strong>Keranjang masih kosong</strong><small>Pilih produk untuk memulai transaksi.</small></div>}
          </div>
          <div className="cashier-payment-section">
            <span className="cashier-section-label">Metode pembayaran</span>
            <div className="cashier-payment-options">
              {paymentOptions.map((option) => <button key={option.id} type="button" className={paymentMethod === option.id ? "is-selected" : ""} onClick={() => setPaymentMethod(option.id)}><span>{option.mark}</span>{option.label}</button>)}
            </div>
            {paymentMethod === "credit" && !customerId && <p className="cashier-inline-hint">Pilih pelanggan untuk pembayaran kasbon.</p>}
          </div>
          <div className="cashier-total">
            <div><span>Subtotal</span><strong>{formatRupiah(totalAmount)}</strong></div>
            <div><span>Diskon</span><strong>{formatRupiah(0)}</strong></div>
            <div className="cashier-grand-total"><span>Total bayar</span><strong>{formatRupiah(totalAmount)}</strong></div>
          </div>
          {errorMessage && <p className="cashier-alert cashier-alert-error" role="alert">{errorMessage}</p>}
          {successMessage && <p className="cashier-alert cashier-alert-success" role="status">{successMessage}</p>}
          <button className="cashier-primary-button cashier-checkout" type="button" disabled={!cart.length || isCheckingOut || (paymentMethod === "credit" && !selectedCustomer)} onClick={checkout}>
            <span>{isCheckingOut ? "Memproses transaksi..." : "Proses pembayaran"}</span><strong>{formatRupiah(totalAmount)}</strong>
          </button>
          <p className="cashier-security-note"><CashierIcon name="lock" />Stok diperbarui otomatis setelah transaksi berhasil.</p>
        </aside>
      </div>
    </section>
  );
}

function CashierIcon({ name }: { name: "search" | "box" | "cart" | "lock" }) {
  const paths = {
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    box: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 8 9 5 9-5M3 8v9l9 5 9-5V8M12 13v9" /></>,
    cart: <><path d="M3 4h2l2.2 11h11.3l2-8H6" /><circle cx="9" cy="19" r="1" /><circle cx="17" cy="19" r="1" /></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" /></>,
  };
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
