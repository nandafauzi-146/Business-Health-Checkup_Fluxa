import { ReactNode } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface KpiCardProps {
  label: string
  value: string
  icon: ReactNode
  change?: number
  changeLabel?: string
}

export function KpiCard({ label, value, icon, change, changeLabel }: KpiCardProps) {
  const isUp = change !== undefined && change >= 0
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--mute)' }}>{label}</span>
        <span style={{ color: 'var(--acc)', background: 'var(--accs)', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>{value}</span>
        {change !== undefined && (
          <span className={`change-pill ${isUp ? 'change-up' : 'change-down'}`}>
            {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
      {changeLabel && (
        <span style={{ fontSize: 11, color: 'var(--mute)' }}>{changeLabel}</span>
      )}
    </div>
  )
}

interface SectionCardProps {
  title?: string
  action?: ReactNode
  children: ReactNode
  style?: React.CSSProperties
}

export function SectionCard({ title, action, children, style }: SectionCardProps) {
  return (
    <div className="card" style={style}>
      {title && (
        <div className="section-header">
          <span className="section-title">{title}</span>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

interface StatusTagProps {
  status?: string
  type?: string
  label?: string
}

export function StatusTag({ status, type, label }: StatusTagProps) {
  const actualStatus = (status || type || 'ok').toLowerCase()
  const map: Record<string, string> = {
    sehat: 'tag-ok',
    aman: 'tag-ok',
    ok: 'tag-ok',
    lunas: 'tag-ok',
    open: 'tag-ok',
    waspada: 'tag-warn',
    menipis: 'tag-warn',
    warn: 'tag-warn',
    sebagian: 'tag-warn',
    kritis: 'tag-bad',
    'belum-lunas': 'tag-bad',
    bad: 'tag-bad',
    void: 'tag-bad',
    closed: 'tag-nt',
  }
  const className = map[actualStatus] || 'tag-nt'
  const labels: Record<string, string> = {
    sehat: 'Sehat', aman: 'Aman', ok: 'OK', lunas: 'Lunas', open: 'Buka',
    waspada: 'Waspada', menipis: 'Menipis', warn: 'Waspada', sebagian: 'Sebagian',
    kritis: 'Kritis', 'belum-lunas': 'Belum Lunas', bad: 'Kritis', void: 'Void', closed: 'Tutup'
  }
  return <span className={`tag ${className}`}>{label || labels[actualStatus] || actualStatus}</span>
}

export function FormatRupiah({ value, amount }: { value?: number; amount?: number }) {
  const val = value !== undefined ? value : (amount !== undefined ? amount : 0)
  return <>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val)}</>
}
