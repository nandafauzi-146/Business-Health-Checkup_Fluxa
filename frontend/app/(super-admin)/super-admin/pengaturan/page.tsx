import styles from '@/features/super-admin/super-admin-content.module.css'

export default function SuperAdminSettingsPage() {
  return (
    <section className={styles.page}>
      <div className={styles.heading}>
        <div><span className={styles.eyebrow}>KONFIGURASI PLATFORM</span><h1>Pengaturan Sistem</h1><p>Pengaturan platform yang memiliki dukungan backend.</p></div>
      </div>
      <div className={styles.callout}>
        <h2>Durasi trial awal: 7 hari</h2>
        <p>Durasi trial awal ditetapkan saat pendaftaran disetujui di server. Konfigurasi saat ini belum disimpan sebagai pengaturan yang dapat diubah, jadi halaman ini tidak menyediakan kontrol perubahan yang belum memiliki backend.</p>
        <p>Perpanjangan atau pengakhiran trial individual dapat dilakukan melalui menu Trial &amp; Langganan dan tercatat di audit log.</p>
      </div>
    </section>
  )
}
