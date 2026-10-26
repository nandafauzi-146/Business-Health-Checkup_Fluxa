'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  Bot,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  Database,
  Headset,
  Package,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  Sun,
  TrendingUp,
  Users,
  Wallet,
  Moon,
  Tag,
  CreditCard,
  Activity,
  Layers,
  type LucideIcon,
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
  const [inView, setInView] = useState(false)
  const [count, setCount] = useState(0)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = cardRef.current
    if (!el) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      setInView(true)
      setCount(82)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold: 0.2 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!inView) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      setCount(82)
      return
    }

    const target = 82
    const duration = 1200
    const start = performance.now()

    let frameId: number
    const step = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(eased * target))

      if (progress < 1) {
        frameId = requestAnimationFrame(step)
      }
    }

    frameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameId)
  }, [inView])

  return (
    <div className={styles.chartCard} ref={cardRef}>
      <div className={styles.chartHeader}>
        <div>
          <h3>Performa Bisnis</h3>
        </div>
        <span className={styles.chartPeriod}>6 bulan terakhir</span>
      </div>

      <div className={styles.chartValueRow}>
        <div className={styles.chartScoreBadge}>
          <TrendingUp size={16} />
        </div>
        <div className={styles.chartScoreText}>
          <strong>{count}</strong>
          <span>/100</span>
        </div>
        <span className={styles.chartTrend}>
          <TrendingUp size={13} /> +18 poin
        </span>
      </div>

      <div
        className={styles.chart}
        role="img"
        aria-label="Grafik performa bisnis yang meningkat dari 40 ke 82 selama enam bulan terakhir"
      >
        <div className={styles.chartGrid}>
          <span>100</span>
          <span>75</span>
          <span>50</span>
          <span>25</span>
        </div>

        <svg viewBox="0 0 500 160" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="chart-growth-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Area fill under curve */}
          <path
            className={`${styles.chartFillPath} ${inView ? styles.chartFillVisible : ''}`}
            d="M 10 112 C 55 110, 65 90, 100 88 C 135 86, 160 80, 195 78 C 235 76, 255 84, 290 82 C 325 80, 355 56, 385 52 C 415 48, 450 32, 485 28 L 485 160 L 10 160 Z"
            fill="url(#chart-growth-fill)"
          />

          {/* Spline line with drawing animation */}
          <path
            className={`${styles.chartLinePath} ${inView ? styles.chartLineAnimated : ''}`}
            d="M 10 112 C 55 110, 65 90, 100 88 C 135 86, 160 80, 195 78 C 235 76, 255 84, 290 82 C 325 80, 355 56, 385 52 C 415 48, 450 32, 485 28"
            fill="none"
            stroke="#2563eb"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* Endpoint glowing dot & pulse */}
          <g className={`${styles.chartEndpoint} ${inView ? styles.chartEndpointVisible : ''}`}>
            <circle cx="485" cy="28" r="9" className={styles.pulseRing} />
            <circle cx="485" cy="28" r="4.5" className={styles.chartDot} />
          </g>
        </svg>
      </div>

      <div className={styles.chartMonths} aria-hidden="true">
        <span>Jan</span>
        <span>Feb</span>
        <span>Mar</span>
        <span>Apr</span>
        <span>Mei</span>
        <span>Jun</span>
      </div>

      <div className={`${styles.insight} ${inView ? styles.insightVisible : ''}`}>
        <div className={styles.insightIcon}>
          <TrendingUp size={16} />
        </div>
        <div className={styles.insightContent}>
          <strong>Tren Penjualan</strong>
          <p>Penjualan meningkat 18% dibanding bulan lalu.</p>
        </div>
        <ArrowRight size={15} className={styles.insightArrow} />
      </div>
    </div>
  )
}

interface MobileCardItem {
  number?: string
  icon: string
  title: string
  description: string
  label?: string
  detail?: string
}

function getConciseDetail(item: MobileCardItem, fallbackIndex: number): string {
  if (item.detail && item.detail !== 'Operasional · Bisnis · Insight') {
    return item.detail
  }
  const featureShort: Record<string, string> = {
    '01': 'Kasir · Shift · Struk',
    '02': 'Omzet · Laba · Arus kas',
    '03': 'Skor AI · Rekomendasi',
    '04': 'Stok · Aset · Mutasi',
    '05': 'Buku kas · Piutang',
    '06': 'Akses · Multi-peran',
  }
  return featureShort[item.number || `0${fallbackIndex + 1}`] || item.label || 'Operasional'
}

function MobilePairsList({
  items,
  defaultIcon = Sparkles,
}: {
  items: MobileCardItem[]
  defaultIcon?: LucideIcon
}) {
  const pairs: Array<[MobileCardItem, MobileCardItem | undefined]> = []
  for (let i = 0; i < items.length; i += 2) {
    pairs.push([items[i], items[i + 1]])
  }

  return (
    <div className={styles.mobilePairsList} aria-label="Mobile paired containers">
      {pairs.map(([col1, col2], pIdx) => {
        const Icon1 = resolveIcon(col1.icon, defaultIcon)
        const num1 = col1.number || `0${pIdx * 2 + 1}`
        const detail1 = getConciseDetail(col1, pIdx * 2)

        const Icon2 = col2 ? resolveIcon(col2.icon, defaultIcon) : null
        const num2 = col2 ? (col2.number || `0${pIdx * 2 + 2}`) : ''
        const detail2 = col2 ? getConciseDetail(col2, pIdx * 2 + 1) : ''

        return (
          <div className={styles.mobilePairCard} key={pIdx}>
            {/* Column 1 */}
            <article className={styles.mobilePairCol}>
              <div className={styles.mobileColTop}>
                <span className={styles.mobileColNumber}>{num1}</span>
              </div>
              <div className={styles.mobileColNotch} aria-hidden="true">
                <div className={styles.mobileNotchDish}>
                  <div className={styles.mobileNotchGlow} />
                  <div className={styles.mobileIconBadge}>
                    <Icon1 size={14} strokeWidth={2.2} />
                  </div>
                </div>
              </div>
              <h3 className={styles.mobileColTitle}>{col1.title}</h3>
              <p className={styles.mobileColDescription}>{col1.description}</p>
              <div className={styles.mobileColMeta}>
                <Clock3 size={10} className={styles.mobileMetaClock} />
                <span>{detail1}</span>
              </div>
            </article>

            {/* Subtle Vertical Divider */}
            {col2 && <div className={styles.mobilePairDivider} aria-hidden="true" />}

            {/* Column 2 */}
            {col2 && (
              <article className={styles.mobilePairCol}>
                <div className={styles.mobileColTop}>
                  <span className={styles.mobileColNumber}>{num2}</span>
                </div>
                <div className={styles.mobileColNotch} aria-hidden="true">
                  <div className={styles.mobileNotchDish}>
                    <div className={styles.mobileNotchGlow} />
                    <div className={styles.mobileIconBadge}>
                      {Icon2 && <Icon2 size={14} strokeWidth={2.2} />}
                    </div>
                  </div>
                </div>
                <h3 className={styles.mobileColTitle}>{col2.title}</h3>
                <p className={styles.mobileColDescription}>{col2.description}</p>
                <div className={styles.mobileColMeta}>
                  <Clock3 size={10} className={styles.mobileMetaClock} />
                  <span>{detail2}</span>
                </div>
              </article>
            )}
          </div>
        )
      })}
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
            <p className={styles.heroDescription}>{cms.hero?.description || 'Kelola transaksi, pahami kesehatan usaha, dan temukan langkah berikutnya dengan bantuan Fluxa — semua dalam satu platform.'}</p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryButton} href="/register">{cms.hero?.ctaText || 'Coba gratis 7 hari'} <ArrowRight size={17} /></Link>
              <a className={styles.secondaryButton} href="#cara-kerja"><span className={styles.playIcon}>↓</span> {cms.hero?.ctaSecondaryText || 'Kenali cara kerjanya'}</a>
            </div>
            <div className={styles.trustNote}><ShieldCheck size={17} /> {cms.hero?.trustNote || 'Data pelanggan Anda aman dan selalu terlindungi'}</div>
          </div>
          <div className={styles.heroVisual}>
            <div className={styles.visualOrb} aria-hidden="true" />
            <div className={styles.dashboardCard}>
              {/* Header Ringkasan Bisnis */}
              <div className={styles.dashboardTop}>
                <div className={styles.dashHeaderLeft}>
                  <span className={styles.dashHeaderIcon}>
                    <Store size={15} />
                  </span>
                  <span className={styles.dashTitle}>Ringkasan Bisnis</span>
                </div>
                <div className={styles.dashPeriodBtn}>
                  <Calendar size={12} />
                  <span>7 hari terakhir</span>
                  <ChevronRight size={12} />
                </div>
              </div>

              {/* Kartu Statistik Total Penjualan & Transaksi */}
              <div className={styles.metricGrid}>
                <div className={styles.metric}>
                  <div className={styles.metricHeader}>
                    <span className={styles.metricIconWrap}>
                      <ShoppingBag size={14} />
                    </span>
                    <span className={styles.metricLabel}>Total Penjualan</span>
                  </div>
                  <strong className={styles.metricValue}>Rp 12,8 jt</strong>
                  <small className={styles.metricTrend}>
                    <span className={styles.positive}>↗ 12,4%</span> <span>dari 7 hari sebelumnya</span>
                  </small>
                </div>

                <div className={styles.metric}>
                  <div className={styles.metricHeader}>
                    <span className={styles.metricIconWrap}>
                      <Receipt size={14} />
                    </span>
                    <span className={styles.metricLabel}>Jumlah Transaksi</span>
                  </div>
                  <strong className={styles.metricValue}>248</strong>
                  <small className={styles.metricTrend}>
                    <span className={styles.positive}>↗ 9,3%</span> <span>dari 7 hari sebelumnya</span>
                  </small>
                </div>
              </div>

              {/* Grafik Performa Penjualan */}
              <div className={styles.miniChart}>
                <div className={styles.miniChartHeader}>
                  <span className={styles.miniChartTitle}>Performa Penjualan</span>
                  <div className={styles.miniChartDropdown}>
                    <span>7 hari</span>
                    <ChevronDown size={13} />
                  </div>
                </div>

                <div className={styles.chartWrapper}>
                  <div className={styles.chartYAxis} aria-hidden="true">
                    <span>15 jt</span>
                    <span>10 jt</span>
                    <span>5 jt</span>
                    <span>0</span>
                  </div>
                  <div className={styles.chartCanvas}>
                    <svg viewBox="0 0 340 100" preserveAspectRatio="none" aria-hidden="true">
                      <defs>
                        <linearGradient id="mini-fill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22" />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <line x1="0" y1="8" x2="340" y2="8" stroke="#f1f5f9" strokeDasharray="3 3" />
                      <line x1="0" y1="38" x2="340" y2="38" stroke="#f1f5f9" strokeDasharray="3 3" />
                      <line x1="0" y1="68" x2="340" y2="68" stroke="#f1f5f9" strokeDasharray="3 3" />
                      <line x1="0" y1="96" x2="340" y2="96" stroke="#f1f5f9" />
                      <path
                        d="M 0 84 C 28 72 45 62 80 65 C 115 68 135 55 170 58 C 205 61 225 44 260 48 C 295 52 315 22 340 8 L 340 96 L 0 96 Z"
                        fill="url(#mini-fill)"
                      />
                      <path
                        d="M 0 84 C 28 72 45 62 80 65 C 115 68 135 55 170 58 C 205 61 225 44 260 48 C 295 52 315 22 340 8"
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      <circle cx="340" cy="8" r="4.5" fill="#2563eb" />
                      <circle cx="340" cy="8" r="7.5" fill="none" stroke="#2563eb" strokeOpacity="0.35" strokeWidth="2" />
                    </svg>
                  </div>
                </div>

                <div className={styles.miniChartLabels} aria-hidden="true">
                  <span>Sen</span>
                  <span>Sel</span>
                  <span>Rab</span>
                  <span>Kam</span>
                  <span>Jum</span>
                  <span>Sab</span>
                  <span>Min</span>
                </div>
              </div>

              {/* Dua Kartu Operasional di Bagian Bawah */}
              <div className={styles.dashBottomCards}>
                <div className={styles.bottomCardSales}>
                  <span className={styles.bottomCardIconBlue}>
                    <BarChart3 size={16} />
                  </span>
                  <div className={styles.bottomCardContent}>
                    <div className={styles.bottomCardTitleRow}>
                      <strong>Ringkasan penjualan</strong>
                      <ChevronRight size={12} className={styles.bottomCardArrow} />
                    </div>
                    <p>Penjualan tertinggi terjadi pada akhir pekan.</p>
                  </div>
                </div>

                <div className={styles.bottomCardStatus}>
                  <span className={styles.bottomCardIconGreen}>
                    <Store size={16} />
                  </span>
                  <div className={styles.bottomCardContent}>
                    <div className={styles.bottomCardTitleRow}>
                      <strong>Bisnis terpantau</strong>
                      <ChevronRight size={12} className={styles.bottomCardArrow} />
                    </div>
                    <p>Operasional berjalan normal.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <a className={styles.scrollCue} href="#fitur" aria-label="Lihat fitur"><ArrowDown size={16} /></a>
      </section>

      <section className={styles.featureSection} id="fitur"><div className={styles.sectionWrap}>
        <div className={styles.sectionHeading}><span className={styles.eyebrow}>SEMUA YANG DIBUTUHKAN</span><h2>Operasional rapi,<br /><span>keputusan makin berarti.</span></h2><p>Fluxa menyatukan aktivitas harian dan insight bisnis agar Anda bisa fokus mengembangkan usaha.</p></div>
        <div className={styles.featureGrid}>
          {featuresList.map((item, idx) => {
            const IconComponent = resolveIcon(item.icon)
            const itemNumber = item.number || `0${idx + 1}`
            const itemDetail = item.detail || 'Operasional · Bisnis · Insight'
            return (
              <article className={styles.notchCard} key={idx}>
                <div className={styles.notchCardHeader}>
                  <span className={styles.notchCardNumber}>{itemNumber}</span>
                </div>
                <div className={styles.cardNotch} aria-hidden="true">
                  <div className={styles.notchDish}>
                    <div className={styles.notchGlow} />
                    <div className={styles.notchIconBadge}>
                      <IconComponent size={22} strokeWidth={2.2} />
                    </div>
                  </div>
                </div>
                <h3 className={styles.notchCardTitle}>{item.title}</h3>
                <p className={styles.notchCardDescription}>{item.description}</p>
                <div className={styles.notchCardDivider} />
                <div className={styles.notchCardMeta}>{itemDetail}</div>
              </article>
            )
          })}
        </div>
        <MobilePairsList items={featuresList} />
      </div></section>

      <section className={styles.aiSection}><div className={`${styles.sectionWrap} ${styles.aiLayout}`}>
        <div className={styles.aiCopy}>
          <span className={styles.eyebrow}><TrendingUp size={14} /> {cms.aiInsight?.eyebrow || 'PEMAHAMAN BISNIS'}</span>
          <h2>{cms.aiInsight?.title || 'Bukan sekadar angka.'}<br /><span>{cms.aiInsight?.titleHighlight || 'Pahami ceritanya.'}</span></h2>
          <p>{cms.aiInsight?.description || 'Fluxa membantu merangkum kondisi usaha dari data operasional Anda, mengidentifikasi tren, dan menyajikan rekomendasi yang lebih mudah ditindaklanjuti.'}</p>
          <ul className={styles.checkList}>
            {(cms.aiInsight?.checklist || [
              'Diagnosis kesehatan bisnis',
              'Tren penjualan dan arus kas',
              'Rekomendasi berdasarkan data',
            ]).map((checkItem, idx) => (
              <li key={idx}><Check size={16} /> {checkItem}</li>
            ))}
          </ul>
          <a href="#cara-kerja" className={styles.textLink}>Pelajari cara kerja Fluxa! <ArrowRight size={16} /></a>
        </div>
        <ExampleChart />
      </div></section>

      <section className={styles.howSection} id="cara-kerja"><div className={styles.sectionWrap}>
        <div className={styles.sectionHeading}><span className={styles.eyebrow}>MUDAH DIMULAI</span><h2>Dari transaksi harian<br /><span>menjadi langkah nyata.</span></h2></div>
        <div className={styles.steps}>
          {stepsList.map((step, idx) => {
            const StepIcon = resolveIcon(step.icon, Database)
            const stepNumber = step.number || `0${idx + 1}`
            return (
              <article className={styles.notchCard} key={idx}>
                <div className={styles.notchCardHeader}>
                  <span className={styles.notchCardNumber}>{stepNumber}</span>
                </div>
                <div className={styles.cardNotch} aria-hidden="true">
                  <div className={styles.notchDish}>
                    <div className={styles.notchGlow} />
                    <div className={styles.notchIconBadge}>
                      <StepIcon size={22} strokeWidth={2.2} />
                    </div>
                  </div>
                </div>
                <h3 className={styles.notchCardTitle}>{step.title}</h3>
                <p className={styles.notchCardDescription}>{step.description}</p>
                <div className={styles.notchCardDivider} />
                <div className={styles.notchCardMeta}>{step.detail}</div>
              </article>
            )
          })}
        </div>
        <MobilePairsList items={stepsList} defaultIcon={Database} />
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