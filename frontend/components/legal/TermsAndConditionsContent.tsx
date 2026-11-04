import React from 'react'

export default function TermsAndConditionsContent() {
  return (
    <article className="terms-content" style={{ color: 'inherit', lineHeight: 1.7, fontSize: '14px' }}>
      <p style={{ marginBottom: '16px', color: '#64748b', fontSize: '13px' }}>
        <strong>Terakhir diperbarui:</strong> 27 Oktober 2026
      </p>

      <p style={{ marginBottom: '16px' }}>
        Selamat datang di <strong>Fluxa</strong> (platform aplikasi kasir pintar / Point of Sale dan sistem analisis kesehatan finansial UMKM modern). Syarat dan Ketentuan Penggunaan ini (&quot;Ketentuan&quot;) mengatur akses dan penggunaan Anda terhadap situs web, aplikasi web, layanan POS, serta modul AI kami di domain <a href="https://business-health-checkup-fluxa.vercel.app/" target="_blank" rel="noopener noreferrer"><strong>business-health-checkup-fluxa.vercel.app/</strong></a> dan seluruh subdomainnya.
      </p>

      <p style={{ marginBottom: '16px' }}>
        Dengan mendaftar akun, mengakses, atau menggunakan layanan Fluxa, Anda menyatakan bahwa Anda telah membaca, memahami, dan menyetujui untuk terikat secara hukum oleh seluruh Ketentuan ini. Jika Anda tidak menyetujui sebagian atau seluruh ketentuan ini, Anda tidak diperkenankan untuk mengakses atau menggunakan layanan Fluxa.
      </p>

      <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '20px 0' }} />

      <section style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'inherit' }}>
          1. Definisi &amp; Istilah
        </h3>
        <ul style={{ paddingLeft: '20px', margin: '0 0 12px 0' }}>
          <li style={{ marginBottom: '6px' }}>
            <strong>&quot;Fluxa&quot;</strong>: Platform piranti lunak sebagai layanan (SaaS) yang mencakup aplikasi POS, manajemen kasbon/piutang, buku kas operasional, dan modul diagnosis keuangan.
          </li>
          <li style={{ marginBottom: '6px' }}>
            <strong>&quot;Pengguna&quot; atau &quot;Anda&quot;</strong>: Pemilik usaha (Owner), pengelola (Admin), kasir, atau perwakilan sah badan usaha/perseorangan yang mendaftar atau menggunakan akun Fluxa.
          </li>
          <li style={{ marginBottom: '6px' }}>
            <strong>&quot;Data Toko&quot;</strong>: Seluruh data riil berupa katalog produk, harga modal (HPP), harga jual, transaksi penjualan, catatan shift kasir, kasbon pelanggan, dan biaya operasional yang diunggah atau dicatat Pengguna ke dalam sistem.
          </li>
          <li style={{ marginBottom: '6px' }}>
            <strong>&quot;FluxAI Advisor / Asisten AI&quot;</strong>: Mesin analisis berbasis kecerdasan buatan (Google Gemini &amp; heuristic engine) yang menyajikan diagnosis rasio keuangan dan rekomendasi perbaikan usaha.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'inherit' }}>
          2. Pendaftaran Akun, Keaslian Data &amp; Keamanan Kredensial
        </h3>
        <ul style={{ paddingLeft: '20px', margin: '0 0 12px 0' }}>
          <li style={{ marginBottom: '6px' }}>
            Pengguna wajib berusia minimal 18 tahun atau telah cakap menurut hukum Indonesia untuk mengikatkan diri dalam perjanjian yang sah.
          </li>
          <li style={{ marginBottom: '6px' }}>
            Pengguna wajib memberikan informasi yang akurat, benar, dan terkini saat pendaftaran, termasuk nama lengkap, alamat email aktif, dan nomor kontak.
          </li>
          <li style={{ marginBottom: '6px' }}>
            Pengguna bertanggung jawab penuh atas kerahasiaan kata sandi (password), sesi login, dan segala aktivitas yang terjadi di bawah akun Pengguna. Fluxa tidak bertanggung jawab atas kerugian akibat kelalaian Pengguna dalam menjaga kerahasiaan kredensial.
          </li>
          <li style={{ marginBottom: '6px' }}>
            Pemilik Akun (Owner) bertanggung jawab atas otorisasi hak akses yang diberikan kepada staf kasir atau admin di dalam tokonya.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'inherit' }}>
          3. Ketentuan Masa Uji Coba Gratis (Free Trial 7 Hari)
        </h3>
        <ul style={{ paddingLeft: '20px', margin: '0 0 12px 0' }}>
          <li style={{ marginBottom: '6px' }}>
            Fluxa menyediakan masa uji coba gratis (Free Trial) selama 7 (tujuh) hari kalender bagi calon pengguna baru untuk mencoba fitur operasional toko.
          </li>
          <li style={{ marginBottom: '6px' }}>
            Pengajuan Free Trial memerlukan verifikasi dan persetujuan dari tim Super Admin Fluxa untuk mencegah penyalahgunaan sistem atau duplikasi pendaftaran akun palsu.
          </li>
          <li style={{ marginBottom: '6px' }}>
            Setelah masa trial berakhir, akses operasional dapat dibatasi kecuali Pengguna memilih untuk mengaktifkan paket langganan berbayar.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'inherit' }}>
          4. Ketentuan Langganan Berbayar &amp; Pembayaran (Payment Gateway)
        </h3>
        <ul style={{ paddingLeft: '20px', margin: '0 0 12px 0' }}>
          <li style={{ marginBottom: '6px' }}>
            Layanan berbayar Fluxa ditagihkan berdasarkan paket (Starter, Growth, Multi-cabang) dengan periode durasi tertentu yang tercantum di aplikasi.
          </li>
          <li style={{ marginBottom: '6px' }}>
            Seluruh transaksi pembayaran digital diproses melalui mitra gerbang pembayaran berlisensi (Midtrans) menggunakan metode pembayaran sah seperti QRIS, Virtual Account Bank, dan transfer bank.
          </li>
          <li style={{ marginBottom: '6px' }}>
            Aktivasi paket langganan yang dibayar melalui Midtrans diproses secara instan dan otomatis begitu verifikasi pembayaran berhasil.
          </li>
          <li style={{ marginBottom: '6px' }}>
            Biaya langganan yang telah dibayarkan bersifat <em>non-refundable</em> (tidak dapat dikembalikan), kecuali apabila terjadi kegagalan teknis sistem pembayaran ganda (*double charge*) yang terbukti secara verifikasi data server.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'inherit' }}>
          5. Penggunaan Modul Kasir (POS) &amp; Pencatatan Transaksi
        </h3>
        <ul style={{ paddingLeft: '20px', margin: '0 0 12px 0' }}>
          <li style={{ marginBottom: '6px' }}>
            Fluxa bertindak sebagai penyedia alat bantu perangkat lunak pencatatan. Fluxa tidak terlibat dalam transaksi fisik jual-beli langsung antara Pengguna dan pembeli akhir toko Anda.
          </li>
          <li style={{ marginBottom: '6px' }}>
            Pengguna bertanggung jawab penuh atas keabsahan, kehalalan, kepatuhan perpajakan, dan legalitas seluruh produk fisik atau jasa yang dijual melalui sistem kasir Fluxa sesuai hukum Indonesia.
          </li>
          <li style={{ marginBottom: '6px' }}>
            Pengelolaan catatan kasbon (piutang pelanggan) dan pembayaran supplier adalah wewenang internal manajemen toko Pengguna.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'inherit' }}>
          6. Pelepasan Tanggung Jawab Fitur AI (Disclaimer AI Financial Advisor)
        </h3>
        <ul style={{ paddingLeft: '20px', margin: '0 0 12px 0' }}>
          <li style={{ marginBottom: '6px' }}>
            Fitur <strong>FluxAI Business Health Checkup</strong> dan <strong>Chatbot Asisten</strong> dirancang untuk memberikan wawasan analitik, ringkasan naratif, dan bahan pertimbangan simulasi bisnis berdasarkan data transaksi yang dicatat Pengguna.
          </li>
          <li style={{ marginBottom: '6px' }}>
            <strong>Bukan Nasihat Finansial Mengikat:</strong> Rekomendasi, estimasi runway kas, dan skor kesehatan dari AI adalah bahan evaluasi pendukung dan BUKAN merupakan nasihat investasi, rekomendasi perbankan, atau jaminan keberhasilan usaha. Segala keputusan operasional, penarikan pinjaman, atau pengeluaran modal tetap menjadi tanggung jawab penuh Pemilik Usaha (Owner).
          </li>
          <li style={{ marginBottom: '6px' }}>
            Chatbot publik di Landing Page beroperasi murni sebagai asisten informasi umum dan tidak memiliki akses ke database transaksi toko Anda.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'inherit' }}>
          7. Perlindungan &amp; Kerahasiaan Data (UU PDP)
        </h3>
        <ul style={{ paddingLeft: '20px', margin: '0 0 12px 0' }}>
          <li style={{ marginBottom: '6px' }}>
            Fluxa berkomitmen menjaga kerahasiaan Data Pribadi dan Data Bisnis Pengguna sesuai dengan Undang-Undang Perlindungan Data Pribadi (UU PDP No. 27 Tahun 2022).
          </li>
          <li style={{ marginBottom: '6px' }}>
            Data keuangan, omzet, dan rincian kasbon toko Anda disimpan secara aman dan diisolasi dengan kontrol akses ketat. Fluxa tidak akan menjual data sensitif bisnis Anda kepada pihak ketiga manapun.
          </li>
          <li style={{ marginBottom: '6px' }}>
            Data bisnis Pengguna hanya diproses untuk kepentingan penyediaan layanan aplikasi, analisis diagnostik akun Pengguna, dan pemeliharaan teknis sistem.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'inherit' }}>
          8. Hak Kekayaan Intelektual
        </h3>
        <p style={{ margin: '0 0 12px 0' }}>
          Seluruh hak cipta, merek dagang, logo, desain antarmuka, kode sumber, dan dokumentasi sistem Fluxa adalah hak kekayaan intelektual milik pengembang Fluxa. Pengguna hanya diberikan lisensi terbatas, non-eksklusif, dan tidak dapat dipindahtangankan untuk menggunakan perangkat lunak selama masa langganan aktif.
        </p>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'inherit' }}>
          9. Pembatasan Tanggung Jawab &amp; Force Majeure
        </h3>
        <p style={{ margin: '0 0 12px 0' }}>
          Fluxa senantiasa berupaya menjaga keandalan dan ketersediaan sistem secara optimal. Namun, Fluxa tidak bertanggung jawab atas gangguan layanan atau kehilangan data yang diakibatkan oleh keadaan kahar (<em>force majeure</em>), seperti bencana alam, gangguan jaringan internet global/ISP, kegagalan listrik massal, atau tindakan peretasan pihak luar di luar kendali wajar sistem.
        </p>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'inherit' }}>
          10. Perubahan Ketentuan &amp; Kontak Bantuan
        </h3>
        <p style={{ margin: '0 0 12px 0' }}>
          Fluxa berhak untuk memperbarui atau mengubah Syarat dan Ketentuan ini sewaktu-waktu. Perubahan akan berlaku efektif setelah diumumkan di halaman ini. Penggunaan berkelanjutan terhadap layanan setelah perubahan tersebut dianggap sebagai persetujuan Anda terhadap ketentuan yang diperbarui.
        </p>
        <p style={{ margin: '0 0 12px 0' }}>
          Jika Anda memiliki pertanyaan mengenai Syarat dan Ketentuan ini, silakan hubungi tim kami melalui:
        </p>
        <ul style={{ paddingLeft: '20px', margin: 0 }}>
          <li style={{ marginBottom: '4px' }}><strong>Website:</strong> https://business-health-checkup-fluxa.vercel.app/</li>
          <li style={{ marginBottom: '4px' }}><strong>WhatsApp Resmi:</strong> +62 898-0148-297</li>
          <li><strong>Dukungan Pengguna:</strong> Layanan Bantuan Fluxa Care</li>
        </ul>
      </section>
    </article>
  )
}
