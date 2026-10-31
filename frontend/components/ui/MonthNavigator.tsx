'use client'

import React from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

interface MonthNavigatorProps {
  selectedMonth: string // Format: 'YYYY-MM' (contoh: '2026-10')
  onChange: (month: string) => void
  minMonth?: string
  maxMonth?: string
  label?: string
  style?: React.CSSProperties
  className?: string
}

export function formatMonthIndo(yearMonth: string): string {
  if (!yearMonth) return ''
  const [yearStr, monthStr] = yearMonth.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10) - 1
  if (isNaN(year) || isNaN(month)) return yearMonth

  const date = new Date(year, month, 1)
  return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

export function getCurrentYearMonth(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function addMonths(yearMonth: string, delta: number): string {
  const [yearStr, monthStr] = yearMonth.split('-')
  let year = parseInt(yearStr, 10)
  let month = parseInt(monthStr, 10) + delta // 1-based

  while (month < 1) {
    month += 12
    year -= 1
  }
  while (month > 12) {
    month -= 12
    year += 1
  }

  return `${year}-${String(month).padStart(2, '0')}`
}

export default function MonthNavigator({
  selectedMonth,
  onChange,
  minMonth,
  maxMonth,
  label = 'Pilih Periode',
  style,
  className = ''
}: MonthNavigatorProps) {
  const currentMonth = getCurrentYearMonth()
  const isCurrent = selectedMonth === currentMonth

  const handlePrev = () => {
    const prev = addMonths(selectedMonth, -1)
    if (!minMonth || prev >= minMonth) {
      onChange(prev)
    }
  }

  const handleNext = () => {
    const next = addMonths(selectedMonth, 1)
    if (!maxMonth || next <= maxMonth) {
      onChange(next)
    }
  }

  const handleCurrent = () => {
    onChange(currentMonth)
  }

  const prevMonthName = formatMonthIndo(addMonths(selectedMonth, -1))
  const nextMonthName = formatMonthIndo(addMonths(selectedMonth, 1))

  return (
    <div
      className={`month-navigator ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
        ...style
      }}
    >
      {label && (
        <span
          className="month-nav-label"
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--mute)',
            marginRight: 2
          }}
        >
          {label}:
        </span>
      )}

      {/* Main Pill: < [Bulan Tahun] > */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 10,
          padding: 2,
          boxShadow: 'var(--shadow-soft)'
        }}
      >
        {/* Tombol Bulan Sebelumnya */}
        <button
          type="button"
          onClick={handlePrev}
          className="icon-btn"
          title={`Ke bulan sebelumnya (${prevMonthName})`}
          aria-label={`Bulan sebelumnya: ${prevMonthName}`}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: 'none',
            background: 'transparent',
            color: 'var(--ink)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <ChevronLeft size={16} />
        </button>

        {/* Display Bulan & Picker Cepat */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            cursor: 'pointer'
          }}
        >
          <Calendar size={13} color="var(--acc)" style={{ flexShrink: 0 }} />
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--ink)',
              whiteSpace: 'nowrap',
              letterSpacing: '-0.01em'
            }}
          >
            {formatMonthIndo(selectedMonth)}
          </span>

          {/* Native month picker transparan di atas teks untuk fleksibilitas klik di Mobile & Tablet */}
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => {
              if (e.target.value) {
                onChange(e.target.value)
              }
            }}
            aria-label="Pilih bulan dan tahun"
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0,
              cursor: 'pointer',
              width: '100%',
              height: '100%'
            }}
          />
        </div>

        {/* Tombol Bulan Berikutnya */}
        <button
          type="button"
          onClick={handleNext}
          className="icon-btn"
          title={`Ke bulan berikutnya (${nextMonthName})`}
          aria-label={`Bulan berikutnya: ${nextMonthName}`}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: 'none',
            background: 'transparent',
            color: 'var(--ink)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Shortcut Tombol "Bulan Ini" jika sedang melihat bulan lain */}
      {!isCurrent && (
        <button
          type="button"
          onClick={handleCurrent}
          className="btn btn-secondary btn-sm"
          style={{
            fontSize: 11.5,
            padding: '5px 9px',
            borderRadius: 8,
            fontWeight: 600
          }}
          title="Kembali ke bulan berjalan saat ini"
        >
          Bulan Ini
        </button>
      )}
    </div>
  )
}

