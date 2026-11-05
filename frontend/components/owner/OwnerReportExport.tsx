'use client'

import { useEffect, useState } from 'react'
import { Download, FileSpreadsheet, FileText, X } from 'lucide-react'
import {
  exportReportCsv,
  exportReportExcel,
  printReportPdf,
  type OwnerReport,
} from '@/lib/owner-report-export'

interface Props {
  report: OwnerReport
  disabled?: boolean
  label?: string
  className?: string
}

export default function OwnerReportExport({
  report,
  disabled = false,
  label = 'Ekspor Laporan',
  className = 'btn btn-secondary',
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isExporting) setIsOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isExporting])

  const exportAs = async (format: 'pdf' | 'xlsx' | 'csv') => {
    setError('')
    setIsExporting(true)
    try {
      if (format === 'pdf') printReportPdf(report)
      if (format === 'xlsx') await exportReportExcel(report)
      if (format === 'csv') exportReportCsv(report)
      setIsOpen(false)
    } catch (exportError) {
      console.error('Unable to export owner report.', exportError)
      setError(exportError instanceof Error ? exportError.message : 'Laporan gagal diekspor. Silakan coba lagi.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <>
      <button
        className={className}
        type="button"
        onClick={() => {
          setError('')
          setIsOpen(true)
        }}
        disabled={disabled}
      >
        <Download size={15} aria-hidden="true" /> {label}
      </button>
      {isOpen && (
        <div
          className="modal-backdrop owner-report-export-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isExporting) setIsOpen(false)
          }}
        >
          <section className="modal-content owner-report-export-dialog" role="dialog" aria-modal="true" aria-labelledby="owner-export-title">
            <header className="owner-report-export-header">
              <div>
                <h2 id="owner-export-title">{report.exportDialogTitle ?? 'Ekspor Laporan'}</h2>
                <p>Pilih format untuk menyimpan laporan sesuai data dan filter saat ini.</p>
              </div>
              <button
                type="button"
                className="owner-report-export-close"
                aria-label="Tutup dialog ekspor"
                onClick={() => setIsOpen(false)}
                disabled={isExporting}
              >
                <X size={18} />
              </button>
            </header>

            <div className="owner-report-export-meta">
              <strong>{report.title}</strong>
              <span>Periode: {report.period}</span>
              <span>{report.rows.length.toLocaleString('id-ID')} baris data</span>
            </div>

            <div className="owner-report-export-options">
              <button type="button" onClick={() => void exportAs('pdf')} disabled={isExporting}>
                <FileText size={19} aria-hidden="true" />
                <span><strong>PDF / Cetak</strong><small>Layout laporan bisnis siap dicetak atau disimpan sebagai PDF</small></span>
              </button>
              <button type="button" onClick={() => void exportAs('xlsx')} disabled={isExporting}>
                <FileSpreadsheet size={19} aria-hidden="true" />
                <span><strong>Excel (.xlsx)</strong><small>Ringkasan KPI dan worksheet detail yang dapat dianalisis</small></span>
              </button>
              <button type="button" onClick={() => void exportAs('csv')} disabled={isExporting}>
                <Download size={19} aria-hidden="true" />
                <span><strong>CSV</strong><small>Data bersih untuk diimpor ke aplikasi spreadsheet</small></span>
              </button>
            </div>

            {error && <p className="owner-report-export-error" role="alert">{error}</p>}

            <footer className="owner-report-export-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setIsOpen(false)} disabled={isExporting}>
                Batal
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  )
}
