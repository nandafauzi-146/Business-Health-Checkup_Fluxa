export type ReportValue = string | number | boolean | null | undefined

export interface ReportColumn {
  key: string
  header: string
  format?: 'currency' | 'date' | 'date-time' | 'time' | 'number' | 'percent'
}

export interface ReportSummaryItem {
  label: string
  value: string | number
  format?: ReportColumn['format']
}

export interface ReportChart {
  title: string
  categories: string[]
  series: { name: string; values: number[]; color: string }[]
}

export interface ReportDetailSection {
  title: string
  description: string
  changes: { field: string; before: string; after: string }[]
}

export interface OwnerReport {
  title: string
  period: string
  fileName: string
  businessName?: string
  generatedBy?: string
  columns: ReportColumn[]
  rows: Record<string, ReportValue>[]
  summary: ReportSummaryItem[]
  chart?: ReportChart
  technicalColumns?: ReportColumn[]
  technicalRows?: Record<string, ReportValue>[]
  detailSections?: ReportDetailSection[]
  csvTableOnly?: boolean
  pdfOrientation?: 'portrait' | 'landscape'
  exportDialogTitle?: string
}

function escapeHtml(value: ReportValue) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function safeFileName(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function generatedAt() {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(new Date())
}

function formatSummaryValue(item: ReportSummaryItem) {
  if (typeof item.value !== 'number') return item.value
  if (item.format === 'currency') {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.value)
  }
  if (item.format === 'percent') return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(item.value)}%`
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(item.value)
}

function download(content: BlobPart, type: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function formattedValue(value: ReportValue, column?: ReportColumn) {
  if ((column?.format === 'date' || column?.format === 'date-time') && value) {
    const date = new Date(String(value))
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('id-ID', {
        ...(column.format === 'date-time'
          ? { dateStyle: 'medium' as const, timeStyle: 'short' as const }
          : { dateStyle: 'medium' as const }),
        timeZone: 'Asia/Jakarta',
      }).format(date)
    }
  }
  if (column?.format === 'time' && value) {
    const date = new Date(String(value))
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Jakarta',
      }).format(date)
    }
  }
  return String(value ?? '')
}

function spreadsheetDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value)
  return new Date(Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second')))
}

function reportChartMarkup(chart?: ReportChart) {
  if (!chart || chart.categories.length === 0 || chart.series.length === 0) return ''

  const width = 920
  const plotTop = 18
  const plotHeight = 150
  const plotLeft = 32
  const plotWidth = width - plotLeft - 16
  const values = chart.series.flatMap((series) => series.values)
  const minimum = Math.min(0, ...values)
  const maximum = Math.max(0, ...values)
  const range = maximum - minimum || 1
  const baseline = plotTop + (maximum / range) * plotHeight
  const groupWidth = plotWidth / chart.categories.length
  const barWidth = Math.min(28, groupWidth / (chart.series.length + 1))
  const bars = chart.categories.flatMap((category, categoryIndex) =>
    chart.series.map((series, seriesIndex) => {
      const value = series.values[categoryIndex] ?? 0
      const barHeight = Math.abs(value / range) * plotHeight
      const x = plotLeft + categoryIndex * groupWidth
        + (groupWidth - barWidth * chart.series.length) / 2
        + seriesIndex * barWidth
      const y = value >= 0 ? baseline - barHeight : baseline
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(3, barWidth - 3).toFixed(1)}" height="${Math.max(1, barHeight).toFixed(1)}" rx="3" fill="${escapeHtml(series.color)}"><title>${escapeHtml(series.name)} · ${escapeHtml(category)}: ${escapeHtml(formatSummaryValue({ label: '', value, format: 'currency' }))}</title></rect>`
    })).join('')
  const labels = chart.categories.map((category, index) =>
    `<text x="${(plotLeft + index * groupWidth + groupWidth / 2).toFixed(1)}" y="${plotTop + plotHeight + 20}" text-anchor="middle">${escapeHtml(category.slice(0, 16))}</text>`).join('')
  const legend = chart.series.map((series) =>
    `<span><i style="background:${escapeHtml(series.color)}"></i>${escapeHtml(series.name)}</span>`).join('')

  return `<section class="chart-section"><h2>${escapeHtml(chart.title)}</h2><div class="chart-legend">${legend}</div><svg viewBox="0 0 ${width} 198" role="img" aria-label="${escapeHtml(chart.title)}"><line x1="${plotLeft}" y1="${baseline.toFixed(1)}" x2="${width - 16}" y2="${baseline.toFixed(1)}" stroke="#cbd5e1" stroke-width="1"/>${bars}${labels}</svg></section>`
}

function csvCell(value: ReportValue, column?: ReportColumn) {
  let text = formattedValue(value, column)
  if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(value)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

export function exportReportCsv(report: OwnerReport) {
  if (report.csvTableOnly) {
    const content = [
      report.columns.map(({ header }) => csvCell(header)).join(','),
      ...report.rows.map((row) => report.columns.map((column) => csvCell(row[column.key], column)).join(',')),
    ].join('\r\n')
    download(`\uFEFF${content}`, 'text/csv;charset=utf-8', `${safeFileName(report.fileName)}.csv`)
    return
  }

  const createdAt = generatedAt()
  const content = [
    [csvCell('Laporan'), csvCell(report.title)].join(','),
    [csvCell('Nama Usaha'), csvCell(report.businessName || 'Tidak tersedia')].join(','),
    [csvCell('Periode'), csvCell(report.period)].join(','),
    [csvCell('Dibuat oleh'), csvCell(report.generatedBy || 'Tidak tersedia')].join(','),
    [csvCell('Dibuat'), csvCell(createdAt)].join(','),
    '',
    report.columns.map(({ header }) => csvCell(header)).join(','),
    ...report.rows.map((row) => report.columns.map((column) => csvCell(row[column.key], column)).join(',')),
  ].join('\r\n')
  download(`\uFEFF${content}`, 'text/csv;charset=utf-8', `${safeFileName(report.fileName)}.csv`)
}

function styleWorksheetTable(
  worksheet: import('exceljs').Worksheet,
  columns: ReportColumn[],
  rows: Record<string, ReportValue>[],
  headerRowNumber: number,
) {
  const headerRow = worksheet.getRow(headerRowNumber)
  headerRow.values = columns.map(({ header }) => header)
  headerRow.height = 30
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } }
    cell.alignment = { vertical: 'middle', wrapText: true }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF0F172A' } } }
  })

  rows.forEach((row, rowIndex) => {
    worksheet.addRow(columns.map((column) => {
      const value = row[column.key] ?? null
      return (column.format === 'date' || column.format === 'date-time' || column.format === 'time')
        && typeof value === 'string'
        ? spreadsheetDate(value)
        : value
    }))
    const rowHeight = columns.reduce((maxLines, column, columnIndex) => {
      const text = String(row[column.key] ?? '')
      const width = Math.max(12, worksheet.getColumn(columnIndex + 1).width ?? 12)
      const lines = text.split(/\r\n|\r|\n/).reduce(
        (total, line) => total + Math.max(1, Math.ceil(line.length / width)),
        0,
      )
      return Math.max(maxLines, lines)
    }, 1)
    worksheet.getRow(headerRowNumber + rowIndex + 1).height = Math.min(rowHeight * 15, 240)
  })

  columns.forEach((column, index) => {
    const valuesLength = rows.reduce((max, row) => Math.max(max, String(row[column.key] ?? '').length), column.header.length)
    const worksheetColumn = worksheet.getColumn(index + 1)
    worksheetColumn.width = Math.min(Math.max(valuesLength + 2, 12), column.format === 'date-time' ? 23 : 42)
    if (column.format === 'currency') worksheetColumn.numFmt = '"Rp" #,##0;[Red]-"Rp" #,##0'
    if (column.format === 'number') worksheetColumn.numFmt = '#,##0.##'
    if (column.format === 'percent') worksheetColumn.numFmt = '0.0%'
    if (column.format === 'date') worksheetColumn.numFmt = 'dd mmm yyyy'
    if (column.format === 'date-time') worksheetColumn.numFmt = 'dd mmm yyyy hh:mm:ss'
    if (column.format === 'time') worksheetColumn.numFmt = 'hh:mm:ss'
  })

  worksheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: headerRowNumber + rows.length, column: columns.length },
  }
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'top', wrapText: true }
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFD8E1EF' } } }
      if (rowNumber % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
      }
    })
  })
}

function setWorksheetTitle(
  worksheet: import('exceljs').Worksheet,
  title: string,
  columnCount: number,
) {
  worksheet.mergeCells(1, 1, 1, columnCount)
  worksheet.getCell('A1').value = title
  worksheet.getCell('A1').font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } }
  worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14213D' } }
  worksheet.getRow(1).height = 34
}

function writeActivityWorkbook(
  workbook: import('exceljs').Workbook,
  report: OwnerReport,
  createdAt: string,
) {
  const summarySheet = workbook.addWorksheet('Ringkasan Aktivitas', {
    properties: { tabColor: { argb: 'FF2563EB' } },
    views: [{ state: 'frozen', ySplit: 1 }],
    pageSetup: { fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: 'landscape' },
  })
  setWorksheetTitle(summarySheet, report.title, report.columns.length)
  summarySheet.addRow(['Nama Usaha', report.businessName || 'Tidak tersedia'])
  summarySheet.addRow(['Periode', report.period])
  summarySheet.addRow(['Dibuat oleh', report.generatedBy || 'Tidak tersedia'])
  summarySheet.addRow(['Tanggal pembuatan', createdAt])
  summarySheet.addRow([])
  summarySheet.addRow(['Ringkasan Aktivitas', ''])
  summarySheet.getRow(6).font = { bold: true, color: { argb: 'FF1D4ED8' } }
  for (const item of report.summary) {
    const row = summarySheet.addRow([item.label, item.value])
    if (item.format === 'number') row.getCell(2).numFmt = '#,##0.##'
  }
  summarySheet.addRow([])
  const headerRowNumber = summarySheet.rowCount + 1
  summarySheet.addRow(['Daftar Aktivitas'])
  summarySheet.mergeCells(headerRowNumber, 1, headerRowNumber, report.columns.length)
  summarySheet.getCell(headerRowNumber, 1).font = { bold: true, size: 13, color: { argb: 'FF1D4ED8' } }
  summarySheet.addRow(report.columns.map(({ header }) => header))
  const tableHeaderRow = headerRowNumber + 1
  styleWorksheetTable(summarySheet, report.columns, report.rows, tableHeaderRow)
  summarySheet.views = [{ state: 'frozen', ySplit: tableHeaderRow }]
  summarySheet.columns.forEach((column, index) => {
    if (report.columns[index]?.format === 'date') column.width = 16
    if (report.columns[index]?.format === 'time') column.width = 13
  })

  const technicalColumns = report.technicalColumns ?? []
  const technicalRows = report.technicalRows ?? []
  const technicalSheet = workbook.addWorksheet('Detail Teknis', {
    properties: { tabColor: { argb: 'FF14B8A6' } },
    views: [{ state: 'frozen', ySplit: 6 }],
    pageSetup: { fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: 'landscape' },
  })
  setWorksheetTitle(technicalSheet, 'Detail Teknis · Laporan Aktivitas', technicalColumns.length)
  technicalSheet.addRow(['Nama Usaha', report.businessName || 'Tidak tersedia'])
  technicalSheet.addRow(['Periode', report.period])
  technicalSheet.addRow(['Dibuat oleh', report.generatedBy || 'Tidak tersedia'])
  technicalSheet.addRow(['Tanggal pembuatan', createdAt])
  technicalSheet.addRow(technicalColumns.map(({ header }) => header))
  styleWorksheetTable(technicalSheet, technicalColumns, technicalRows, 6)
  technicalSheet.views = [{ state: 'frozen', ySplit: 6 }]
  technicalColumns.forEach((column, index) => {
    if (column.key === 'before' || column.key === 'after') technicalSheet.getColumn(index + 1).width = 55
    if (column.key === 'recordId' || column.key === 'activityId') technicalSheet.getColumn(index + 1).width = 38
  })
}

export async function exportReportExcel(report: OwnerReport) {
  const createdAt = generatedAt()
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Fluxa'
  workbook.created = new Date()
  workbook.modified = new Date()

  if (report.technicalColumns && report.technicalRows) {
    writeActivityWorkbook(workbook, report, createdAt)
    const activityBuffer = await workbook.xlsx.writeBuffer()
    download(activityBuffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `${safeFileName(report.fileName)}.xlsx`)
    return
  }

  const summarySheet = workbook.addWorksheet('Ringkasan', {
    properties: { tabColor: { argb: 'FF2563EB' } },
  })
  summarySheet.columns = [{ width: 30 }, { width: 38 }]
  summarySheet.mergeCells('A1:B1')
  summarySheet.getCell('A1').value = report.title
  summarySheet.getCell('A1').font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } }
  summarySheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14213D' } }
  summarySheet.getRow(1).height = 32
  summarySheet.addRow(['Nama Usaha', report.businessName || 'Tidak tersedia'])
  summarySheet.addRow(['Periode', report.period])
  summarySheet.addRow(['Dibuat oleh', report.generatedBy || 'Tidak tersedia'])
  summarySheet.addRow(['Dibuat', createdAt])
  summarySheet.addRow([])
  summarySheet.addRow(['Ringkasan Eksekutif', ''])
  summarySheet.getRow(7).font = { bold: true, color: { argb: 'FF1D4ED8' } }
  for (const item of report.summary) {
    const row = summarySheet.addRow([item.label, item.value])
    if (item.format === 'currency') row.getCell(2).numFmt = '"Rp" #,##0;[Red]-"Rp" #,##0'
    if (item.format === 'number') row.getCell(2).numFmt = '#,##0.##'
    if (item.format === 'percent') row.getCell(2).numFmt = '0.0"%"'
  }
  summarySheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1 && rowNumber !== 6) {
      row.eachCell((cell) => {
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFD8E1EF' } } }
        cell.alignment = { vertical: 'middle', wrapText: true }
      })
    }
  })

  const detailSheet = workbook.addWorksheet('Detail', {
    properties: { tabColor: { argb: 'FF14B8A6' } },
    views: [{ state: 'frozen', ySplit: 6 }],
    pageSetup: { fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: report.columns.length > 6 ? 'landscape' : 'portrait' },
  })
  detailSheet.mergeCells(1, 1, 1, report.columns.length)
  detailSheet.getCell(1, 1).value = report.title
  detailSheet.getCell(1, 1).font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } }
  detailSheet.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14213D' } }
  detailSheet.getRow(1).height = 32
  detailSheet.getCell('A2').value = 'Nama Usaha'
  detailSheet.getCell('B2').value = report.businessName || 'Tidak tersedia'
  detailSheet.getCell('A3').value = 'Periode'
  detailSheet.getCell('B3').value = report.period
  detailSheet.getCell('A4').value = 'Dibuat oleh'
  detailSheet.getCell('B4').value = report.generatedBy || 'Tidak tersedia'
  detailSheet.getCell('A5').value = 'Dibuat'
  detailSheet.getCell('B5').value = createdAt
  const headerRow = detailSheet.getRow(6)
  headerRow.values = report.columns.map(({ header }) => header)
  headerRow.height = 28
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } }
    cell.alignment = { vertical: 'middle', wrapText: true }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF0F172A' } } }
  })

  for (const row of report.rows) {
    detailSheet.addRow(report.columns.map((column) => {
      const value = row[column.key] ?? null
      return column.format === 'date' && typeof value === 'string' ? spreadsheetDate(value) : value
    }))
  }
  report.columns.forEach((column, index) => {
    const valuesLength = report.rows.reduce((max, row) => Math.max(max, String(row[column.key] ?? '').length), column.header.length)
    const worksheetColumn = detailSheet.getColumn(index + 1)
    worksheetColumn.width = Math.min(Math.max(valuesLength + 2, 12), 42)
    if (column.format === 'currency') worksheetColumn.numFmt = '"Rp" #,##0;[Red]-"Rp" #,##0'
    if (column.format === 'number') worksheetColumn.numFmt = '#,##0.##'
    if (column.format === 'percent') worksheetColumn.numFmt = '0.0%'
    if (column.format === 'date') worksheetColumn.numFmt = 'dd mmm yyyy hh:mm'
  })
  detailSheet.autoFilter = {
    from: { row: 6, column: 1 },
    to: { row: 6 + report.rows.length, column: report.columns.length },
  }
  detailSheet.eachRow((row, rowNumber) => {
    if (rowNumber < 7) return
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'top', wrapText: true }
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFD8E1EF' } } }
      if (rowNumber % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
      }
    })
  })

  const buffer = await workbook.xlsx.writeBuffer()
  download(buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `${safeFileName(report.fileName)}.xlsx`)
}

export function printReportPdf(report: OwnerReport) {
  const createdAt = generatedAt()
  const printWindow = window.open('', '_blank')
  if (!printWindow) throw new Error('Popup diblokir browser. Izinkan popup untuk mencetak laporan.')

  const summary = report.summary.map((item) =>
    `<article class="kpi"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(formatSummaryValue(item))}</strong></article>`).join('')
  const chart = reportChartMarkup(report.chart)
  const headers = report.columns.map(({ header }) => `<th>${escapeHtml(header)}</th>`).join('')
  const rows = report.rows.length
    ? report.rows.map((row) => `<tr>${report.columns.map((column) => `<td>${escapeHtml(formattedValue(row[column.key], column)) || '—'}</td>`).join('')}</tr>`).join('')
    : `<tr><td class="empty" colspan="${report.columns.length}">Tidak ada data untuk filter dan periode ini.</td></tr>`
  const detailSections = report.detailSections?.length
    ? `<section class="change-details"><h2>Detail Perubahan</h2>${report.detailSections.map((section) => `
        <article class="change-card">
          <h3>${escapeHtml(section.title)}</h3>
          <p>${escapeHtml(section.description)}</p>
          <table><thead><tr><th>Informasi</th><th>Sebelum</th><th>Sesudah</th></tr></thead><tbody>
            ${section.changes.map((change) => `<tr><td>${escapeHtml(change.field)}</td><td>${escapeHtml(change.before)}</td><td>${escapeHtml(change.after)}</td></tr>`).join('')}
          </tbody></table>
        </article>`).join('')}</section>`
    : ''
  const orientation = report.pdfOrientation
    ?? (report.columns.length > 6 ? 'landscape' : 'portrait')

  printWindow.opener = null
  printWindow.document.open()
  printWindow.document.write(`<!doctype html>
    <html lang="id">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${escapeHtml(safeFileName(report.fileName))}</title>
        <style>
          :root { color-scheme: light; font-family: Arial, Helvetica, sans-serif; color: #172033; }
          * { box-sizing: border-box; }
          body { margin: 0; padding: 32px; background: #fff; font-size: 10px; }
          header { display: flex; align-items: flex-start; gap: 12px; border-bottom: 3px solid #2563eb; padding-bottom: 18px; margin-bottom: 22px; }
          .logo { width: 42px; height: 42px; object-fit: contain; }
          .header-copy { flex: 1; }
          .brand { color: #2563eb; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
          h1 { margin: 8px 0 6px; font-size: 24px; }
          .meta { margin: 0; color: #526078; line-height: 1.65; }
          .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin: 0 0 24px; }
          .kpi { padding: 12px; border: 1px solid #dbe3ef; border-radius: 8px; background: #f7f9fc; break-inside: avoid; }
          .kpi span { display: block; color: #5c6b82; font-size: 9px; text-transform: uppercase; letter-spacing: .05em; }
          .kpi strong { display: block; margin-top: 6px; font-size: 15px; }
          .chart-section { margin: 0 0 24px; break-inside: avoid; }
          .chart-section h2 { margin: 0 0 8px; }
          .chart-section svg { display: block; width: 100%; max-height: 220px; overflow: visible; }
          .chart-section svg text { fill: #526078; font: 9px Arial, sans-serif; }
          .chart-legend { display: flex; flex-wrap: wrap; gap: 12px; color: #526078; font-size: 9px; }
          .chart-legend span { display: inline-flex; align-items: center; gap: 5px; }
          .chart-legend i { width: 8px; height: 8px; border-radius: 2px; }
          h2 { margin: 0 0 9px; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; table-layout: auto; }
          thead { display: table-header-group; }
          th { background: #172b4d; color: #fff; text-align: left; }
          th, td { padding: 8px 9px; border: 1px solid #dbe3ef; vertical-align: top; overflow-wrap: anywhere; }
          tbody tr:nth-child(even) { background: #f1f5f9; }
          tr { break-inside: avoid; }
          .empty { color: #64748b; text-align: center; padding: 24px; }
          .change-details { margin-top: 22px; }
          .change-card { margin: 0 0 12px; padding: 12px; border: 1px solid #dbe3ef; border-radius: 7px; break-inside: avoid; }
          .change-card h3 { margin: 0 0 4px; font-size: 11px; }
          .change-card p { margin: 0 0 8px; color: #526078; }
          footer { position: fixed; right: 0; bottom: -7mm; left: 0; padding-top: 5px; border-top: 1px solid #dbe3ef; color: #64748b; font-size: 9px; }
          @page { size: A4 ${orientation}; margin: 14mm; @bottom-right { content: "Halaman " counter(page); color: #64748b; font: 9px Arial, sans-serif; } }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <header>
          <img class="logo" src="/Fluxa-Logo.webp" alt="Logo Fluxa">
          <div class="header-copy">
            <div class="brand">Fluxa · Laporan Bisnis</div>
            <h1>${escapeHtml(report.title)}</h1>
            <p class="meta">Usaha: ${escapeHtml(report.businessName || 'Tidak tersedia')}<br>Periode: ${escapeHtml(report.period)}<br>Dibuat oleh: ${escapeHtml(report.generatedBy || 'Tidak tersedia')}<br>Dibuat: ${escapeHtml(createdAt)} WIB</p>
          </div>
        </header>
        <section class="summary">${summary}</section>
        ${chart}
        <section>
          <h2>${escapeHtml(report.title)}</h2>
          <table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>
        </section>
        ${detailSections}
        <footer>${escapeHtml(report.businessName || 'Tidak tersedia')} · ${escapeHtml(createdAt)} WIB</footer>
        <script>window.addEventListener('load', () => { const images = [...document.images]; Promise.all(images.map((image) => image.decode().catch(() => undefined))).then(() => window.setTimeout(() => window.print(), 150)); });</script>
      </body>
    </html>`)
  printWindow.document.close()
}
