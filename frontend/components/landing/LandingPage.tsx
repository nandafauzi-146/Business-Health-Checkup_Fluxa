'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useLayoutEffect, useState, type MouseEvent } from 'react'
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  Database,
  Headset,
  Package,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Sun,
  TrendingUp,
  Users,
  Wallet,
  Moon,
  Tag,
  CreditCard,
  Activity,
  Layers,
} from 'lucide-react'
import { useTheme } from '@/components/layout/ThemeProvider'
import type { LandingCMSContent } from '@/lib/cms'
import defaultContent from '@/content/landing-default.json'
import styles from './landingpage.module.css'

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>> = {
  ShoppingCart,
  BarChart3,
  Bot,
  Package,
  Wallet,
  Users,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Database,
  CircleDollarSign,
  ClipboardCheck,
  Headset,
  Tag,
  CreditCard,
  Activity,
  Layers,
}

function resolveIcon(name: string, fallback = Sparkles) {
  return ICON_MAP[name] || fallback
}

const defaultPackages = [
  { name: 'Starter', description: 'Untuk usaha kecil yang ingin mulai lebih rapi.', features: ['Kasir & pencatatan transaksi', 'Manajemen produk dan stok', 'Ringkasan laporan usaha'] },
  { name: 'Growth', description: 'Untuk bisnis yang ingin memahami performa lebih dalam.', features: ['Semua fitur Starter', 'Diagnosis kesehatan bisnis berbasis AI', 'Analisis kas dan piutang'], featured: true },
  { name: 'Multi-cabang', description: 'Untuk tim dan operasional dengan kebutuhan lebih luas.', features: ['Semua fitur Growth', 'Pengelolaan tim dan peran', 'Diskusi kebutuhan penggunaan'] },
]

function ExampleChart() {
  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div><span className={styles.eyebrow}>CONTOH ANALISIS AI</span><h3>Skor kesehatan bisnis</h3></div>
        <span className={styles.chartPeriod}>6 bulan terakhir</span>
      </div>
      <div className={styles.chartValue}><strong>82</strong><span>/ 100</span><span className={styles.chartTrend}><TrendingUp size={15} /> +18 poin</span></div>
      <div className={styles.chart} role="img" aria-label="Grafik ilustrasi skor kesehatan bisnis yang meningkat dari 64 ke 82 selama enam bulan">
        <div className={styles.chartGrid}><span>100</span><span>75</span><span>50</span><span>25</span></div>
        <svg viewBox="0 0 540 190" preserveAspectRatio="none" aria-hidden="true">
          <defs><linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#3878f6" stopOpacity=".19" /><stop offset="100%" stopColor="#3878f6" stopOpacity="0" /></linearGradient></defs>
          <path d="M0 68 C42 66 48 58 90 61 S142 54 180 58 S231 48 270 52 S319 44 360 46 S412 37 450 42 S504 31 540 34 L540 190 L0 190 Z" fill="url(#chart-fill)" />
          <path d="M0 68 C42 66 48 58 90 61 S142 54 180 58 S231 48 270 52 S319 44 360 46 S412 37 450 42 S504 31 540 34" fill="none" stroke="#3878f6" strokeWidth="3" vectorEffect="non-scaling-stroke" />
          <circle cx="540" cy="34" r="5" fill="#fff" stroke="#3878f6" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className={styles.chartMonths} aria-hidden="true"><span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>Mei</span><span>Jun</span></div>
      <div className={styles.insight}><span className={styles.insightIcon}><Sparkles size={16} /></span><p><strong>Insight FluxAI</strong><br />Arus kas dan konsistensi transaksi menunjukkan tren yang membaik.</p><span className={styles.sampleNote}>Ilustrasi</span></div>
    </div>
  )
}

export default function LandingPage({ content }: { content?: LandingCMSContent }) {
  const router = useRouter()
  const { isDark, setPreference } = useTheme()
  const [introActive, setIntroActive] = useState(true)
  const [isLeaving, setIsLeaving] = useState(false)

  const cms = content || (defaultContent as unknown as LandingCMSContent)
  const whatsappUrl = `https://wa.me/${(cms.contact?.whatsappNumber || '628980148297').replace(/\D/g, '')}?text=${encodeURIComponent(cms.contact?.whatsappMessage || '')}`
  const featuresList = cms.features || []
  const stepsList = cms.steps || []
  const faqsList = cms.faqs || []

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timeout = window.setTimeout(() => setIntroActive(false), reduceMotion ? 0 : 2100)
    return () => window.clearTimeout(timeout)
  }, [])

  useLayoutEffect(() => {
    if (!window.location.hash) return

    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}`,
    )
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [])

  function handlePageClick(event: MouseEvent<HTMLElement>) {
    if (!(event.target instanceof Element)) return

    const anchor = event.target.closest('a')
    if (!anchor || anchor.target === '_blank' || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

    const destination = new URL(anchor.href, window.location.href)
    if (destination.origin !== window.location.origin) return

    if (destination.pathname === window.location.pathname && destination.hash) {
      const target = document.getElementById(decodeURIComponent(destination.hash.slice(1)))
      if (!target) return

      event.preventDefault()
      target.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      })
      anchor.closest('details[open]')?.removeAttribute('open')
      window.history.pushState(null, '', destination.hash)
      return
    }

    if (destination.hash || destination.pathname === window.location.pathname) return

    event.preventDefault()
    if (isLeaving) return

    setIsLeaving(true)
    window.setTimeout(() => router.push(`${destination.pathname}${destination.search}${destination.hash}`), 420)
  }

  return (
    <main className={`${styles.page}${isLeaving ? ` ${styles.isLeaving}` : ''}`} onClick={handlePageClick}>
      {introActive && (
        <div className={styles.introOverlay} aria-hidden="true">
          <div className={styles.introContent}>
            <span className={styles.introOrbit} />
            <span className={styles.introGlow} />
            <Image className={styles.introLogo} src="/Fluxa-Logo.webp" alt="" width={144} height={144} priority />
            <span className={styles.introWordmark}>fluxa<span>.</span></span>
            <span className={styles.introCaption}>Membuka ruang untuk bisnis bertumbuh</span>
          </div>
        </div>
      )}
      <header className={styles.header}>
        <div className={styles.navWrap}>
          <Link className={styles.brand} href="/" aria-label="Fluxa, beranda"><Image src="/Fluxa-Logo.webp" alt="" width={42} height={42} priority /><span>fluxa<span className={styles.brandDot}>.</span></span></Link>
          <nav className={styles.desktopNav} aria-label="Navigasi utama"><a href="#fitur">Fitur</a><a href="#cara-kerja">Cara kerja</a><a href="#kontak">Kontak</a><a href="#paket">Subscribe</a></nav>
          <div className={styles.navActions}>
            <button className={styles.themeToggle} type="button" onClick={() => setPreference(isDark ? 'light' : 'dark')} aria-label={`Aktifkan mode ${isDark ? 'terang' : 'gelap'}`} title={`Mode ${isDark ? 'terang' : 'gelap'}`}>
              {isDark ? <Sun size={17} /> : <Moon size={17} />}
              <span>{isDark ? 'Terang' : 'Gelap'}</span>
            </button>
            <Link className={styles.loginLink} href="/login">Masuk</Link><Link className={styles.navCta} href="/register">Registrasi <ArrowRight size={15} /></Link>
          </div>
          <details className={styles.mobileMenu}>
            <summary aria-label="Buka menu"><span /><span /><span /></summary>
            <nav aria-label="Navigasi seluler"><a href="#fitur">Fitur</a><a href="#cara-kerja">Cara kerja</a><a href="#kontak">Kontak</a><a href="#paket">Subscribe</a><Link href="/login">Login</Link><Link href="/register">Registrasi</Link></nav>
          </details>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <div className={styles.heroEyebrowRow}>
              <div className={styles.pill}><span /> {cms.hero?.eyebrow || 'Platform bisnis untuk UMKM modern'}</div>
              <div className={styles.heroStamp}><CircleDollarSign size={18} /> {cms.hero?.badge || 'Data usaha, satu dashboard'}</div>
            </div>
            <h1>{cms.hero?.title || 'Bisnis lebih terarah.'}<br /><span>{cms.hero?.titleHighlight || 'Tumbuh lebih percaya diri.'}</span></h1>
            <p className={styles.heroDescription}>{cms.hero?.description || 'Kelola transaksi, pahami kesehatan usaha, dan temukan langkah berikutnya dengan bantuan AI — semua dalam satu platform.'}</p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryButton} href="/register">{cms.hero?.ctaText || 'Coba gratis 7 hari'} <ArrowRight size={17} /></Link>
              <a className={styles.secondaryButton} href="#cara-kerja"><span className={styles.playIcon}>↓</span> {cms.hero?.ctaSecondaryText || 'Kenali cara kerjanya'}</a>
            </div>
            <div className={styles.trustNote}><ShieldCheck size={17} /> {cms.hero?.trustNote || 'Satu platform untuk operasional dan insight bisnis'}</div>
          </div>
          <div className={styles.heroVisual}>
            <div className={styles.visualOrb} aria-hidden="true" />
            <div className={styles.dashboardCard}>
              <div className={styles.dashboardTop}><span className={styles.dashTitle}>Contoh ringkasan bisnis</span><span className={styles.liveDot}>● Simulasi</span></div>
              <div className={styles.metricGrid}><div className={styles.metric}><span>Total penjualan</span><strong>Rp 12,8 jt</strong><small className={styles.positive}>↗ 12,4%</small></div><div className={styles.metric}><span>Transaksi</span><strong>248</strong><small>Periode ini</small></div></div>
              <div className={styles.miniChart}><div className={styles.miniChartTitle}><span>Performa penjualan</span><span>7 hari</span></div><svg viewBox="0 0 410 120" preserveAspectRatio="none" aria-hidden="true"><path d="M0 94 C25 83 28 52 61 65 S97 90 121 70 S153 45 180 55 S216 28 243 42 S279 58 300 35 S333 49 354 24 S390 28 410 8" fill="none" stroke="#4485ff" strokeWidth="3" vectorEffect="non-scaling-stroke" /><path d="M0 94 C25 83 28 52 61 65 S97 90 121 70 S153 45 180 55 S216 28 243 42 S279 58 300 35 S333 49 354 24 S390 28 410 8 L410 120 L0 120Z" fill="url(#mini-fill)" opacity=".55" /><defs><linearGradient id="mini-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#4485ff" stopOpacity=".28" /><stop offset="100%" stopColor="#4485ff" stopOpacity="0" /></linearGradient></defs></svg><div className={styles.miniChartLabels}><span>Sen</span><span>Rab</span><span>Jum</span><span>Min</span></div></div>
              <div className={styles.aiTip}><span><Sparkles size={16} /></span><div><strong>Insight FluxAI</strong><p>Penjualan tertinggi terjadi pada akhir pekan.</p></div><ArrowRight size={16} /></div>
            </div>
            <div className={styles.floatBadge}><span><ClipboardCheck size={17} /></span><div><strong>Bisnis terpantau</strong><small>Laporan diperbarui otomatis</small></div></div>
          </div>
        </div>
        <a className={styles.scrollCue} href="#fitur" aria-label="Lihat fitur"><ArrowDown size={16} /></a>
      </section>

      <section className={styles.featureSection} id="fitur"><div className={styles.sectionWrap}>
        <div className={styles.sectionHeading}><span className={styles.eyebrow}>SEMUA YANG DIBUTUHKAN</span><h2>Operasional rapi,<br /><span>keputusan makin berarti.</span></h2><p>Fluxa menyatukan aktivitas harian dan insight bisnis agar Anda bisa fokus mengembangkan usaha.</p></div>
        <div className={styles.featureGrid}>
          {featuresList.map((item, idx) => {
            const IconComponent = resolveIcon(item.icon)
            return (
              <article className={styles.featureCard} key={idx}>
                <span className={`${styles.featureIcon} ${styles[item.tone] || styles.blue}`}>
                  <IconComponent size={21} strokeWidth={1.8} />
                </span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <span className={styles.cardArrow}><ArrowRight size={16} /></span>
              </article>
            )
          })}
        </div>
      </div></section>

      <section className={styles.aiSection}><div className={`${styles.sectionWrap} ${styles.aiLayout}`}>
        <div className={styles.aiCopy}>
          <span className={styles.eyebrow}><Sparkles size={14} /> {cms.aiInsight?.eyebrow || 'INSIGHT BISNIS BERBANTU AI'}</span>
          <h2>{cms.aiInsight?.title || 'Bukan sekadar angka.'}<br /><span>{cms.aiInsight?.titleHighlight || 'Pahami ceritanya.'}</span></h2>
          <p>{cms.aiInsight?.description || 'FluxAI membantu merangkum kondisi usaha dari data operasional Anda, mengidentifikasi tren, dan menyajikan rekomendasi yang lebih mudah ditindaklanjuti.'}</p>
          <ul className={styles.checkList}>
            {(cms.aiInsight?.checklist || []).map((checkItem, idx) => (
              <li key={idx}><Check size={16} /> {checkItem}</li>
            ))}
          </ul>
          <a href="#cara-kerja" className={styles.textLink}>Pelajari cara kerja FluxAI <ArrowRight size={16} /></a>
        </div>
        <ExampleChart />
      </div></section>

      <section className={styles.howSection} id="cara-kerja"><div className={styles.sectionWrap}>
        <div className={styles.sectionHeading}><span className={styles.eyebrow}>MUDAH DIMULAI</span><h2>Dari transaksi harian<br /><span>menjadi langkah nyata.</span></h2></div>
        <div className={styles.steps}>
          {stepsList.map((step, idx) => {
            const StepIcon = resolveIcon(step.icon, Database)
            return (
              <article className={styles.step} key={idx}>
                <div className={styles.stepHead}>
                  <span className={styles.stepNumber}>{step.number || `0${idx + 1}`}</span>
                  <span className={styles.stepIcon}><StepIcon size={19} /></span>
                  <span className={styles.stepLabel}>{step.label}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
                <div className={styles.stepDetail}><Clock3 size={14} /><span>{step.detail}</span></div>
              </article>
            )
          })}
        </div>
      </div></section>

      <section className={styles.contactSection} id="kontak">
        <div className={styles.contactCard}>
          <span className={styles.contactIcon}><Headset size={23} /></span>
          <div>
            <span className={styles.eyebrow}>{cms.contact?.eyebrow || 'ADA PERTANYAAN?'}</span>
            <h2>{cms.contact?.heading || 'Mari bicarakan kebutuhan bisnis Anda.'}</h2>
            <p>{cms.contact?.description || 'Tim Fluxa siap membantu Anda memahami fitur, trial, dan pilihan paket yang sesuai.'}</p>
          </div>
          <a className={styles.secondaryButton} href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            {cms.contact?.buttonText || 'Tanya via WhatsApp'} <ArrowRight size={16} />
          </a>
        </div>
      </section>

      <section className={styles.trialSection} id="trial">
        <div className={styles.trialDecor} aria-hidden="true"><span /><span /><span /></div>
        <div className={styles.trialContent}>
          <span className={styles.trialPill}><Sparkles size={14} /> {cms.trialBanner?.pill || 'MULAI BERSAMA FLUXA'}</span>
          <h2>{cms.trialBanner?.title || 'Mulai bisnis Anda'}<br />dengan <span>{cms.trialBanner?.titleHighlight || 'cara fleksibel.'}</span></h2>
          <p>{cms.trialBanner?.description || 'Daftar sekarang. Pilih langganan langsung untuk aktivasi instan tanpa antrean, atau ajukan free trial 7 hari gratis.'}</p>
          <Link className={styles.trialButton} href="/register">{cms.trialBanner?.ctaText || 'Mulai Sekarang'} <ArrowRight size={17} /></Link>
          <span className={styles.trialFootnote}><ShieldCheck size={15} /> {cms.trialBanner?.footnote || 'Langganan instan via Midtrans atau Trial gratis 7 hari'}</span>
        </div>
      </section>

      <section className={styles.pricingSection} id="paket">
        <div className={styles.sectionWrap}>
          <div className={styles.sectionHeading}>
            <span className={styles.eyebrow}>{cms.pricing?.eyebrow || 'PILIH SESUAI KEBUTUHAN'}</span>
            <h2>
              {cms.pricing?.title || 'Paket yang tumbuh'}<br />
              <span>{cms.pricing?.titleHighlight || 'bersama bisnis Anda.'}</span>
            </h2>
            <p>{cms.pricing?.description || 'Mulai dengan trial 7 hari, lalu pilih kategori paket yang paling sesuai dengan tahap bisnis Anda.'}</p>
          </div>
          <div className={styles.packageGrid}>
            {(cms.pricing?.packages || defaultPackages).map((plan, idx) => (
              <article className={`${styles.packageCard} ${plan.featured ? styles.packageFeatured : ''}`} key={plan.name || idx}>
                {plan.featured && <span className={styles.popularBadge}>{plan.badge || 'Pilihan bisnis'}</span>}
                <h3>{plan.name}</h3>
                <p className={styles.packageDescription}>{plan.description}</p>
                <div className={styles.packagePrice}>
                  {plan.priceLabel || 'Hubungi kami'}
                  <small>{plan.priceSublabel || 'untuk informasi harga'}</small>
                </div>
                <a className={plan.featured ? styles.primaryButton : styles.packageButton} href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                  {cms.pricing?.buttonText || 'Tanyakan paket'} <ArrowRight size={16} />
                </a>
                <div className={styles.packageDivider} />
                <span className={styles.packageIncludes}>Yang termasuk:</span>
                <ul>
                  {(plan.features || []).map((feature, fIdx) => (
                    <li key={fIdx}><Check size={15} />{feature}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.faqSection} id="faq"><div className={`${styles.sectionWrap} ${styles.faqLayout}`}>
        <div className={styles.faqIntro}><span className={styles.eyebrow}>FAQ</span><h2>Pertanyaan yang<br /><span>sering ditanyakan.</span></h2><p>Belum menemukan jawaban? Hubungi tim Fluxa untuk informasi lebih lanjut.</p><a className={styles.textLink} href={whatsappUrl} target="_blank" rel="noopener noreferrer">Hubungi kami via WhatsApp <ArrowRight size={16} /></a></div>
        <div className={styles.faqList}>
          {faqsList.map((faq, idx) => (
            <details className={styles.faqItem} key={idx}>
              <summary>{faq.question}<ChevronDown size={18} /></summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </div></section>

      <footer className={styles.footer}><div className={styles.footerInner}><Link className={styles.brand} href="/"><Image src="/Fluxa-Logo.webp" alt="" width={34} height={34} /><span>fluxa<span className={styles.brandDot}>.</span></span></Link><p>{cms.footer?.tagline || 'Kelola hari ini. Tumbuh untuk esok.'}</p><div><a href="#fitur">Fitur</a><a href="#kontak">Kontak</a><Link href="/login">Login</Link></div></div><span className={styles.copyright}>© {new Date().getFullYear()} Fluxa. {cms.footer?.copyright || 'Semua hak dilindungi.'}</span></footer>
    </main>
  )
}