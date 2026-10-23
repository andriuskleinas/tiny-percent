import { jsPDF } from 'jspdf'
import type { Report, Table } from './report'

/**
 * Lays a `Report` out as an A4 PDF, drawn in the browser: no server sees the
 * deal. Loaded only when someone asks for a PDF, so the library never weighs on
 * the page itself. Text uses the PDF's built-in Helvetica, so no font is
 * embedded and the file stays small.
 */

type Rgb = readonly [number, number, number]

// The site's light palette, so the PDF reads as the same product.
const INK: Rgb = [21, 22, 26]
const SOFT: Rgb = [74, 76, 85]
const FAINT: Rgb = [101, 103, 111]
const RULE: Rgb = [221, 214, 200]
const ACCENT: Rgb = [127, 147, 255]
const WASH: Rgb = [230, 233, 255]
const SUNK: Rgb = [236, 231, 220]
const GAIN: Rgb = [26, 110, 73]
const DILUTE: Rgb = [168, 62, 37]
// Buy Me a Coffee's yellow, #FFDD00, as on the site.
const MARKER: Rgb = [255, 221, 0]

const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 48
const WIDTH = PAGE_W - 2 * MARGIN
const FOOTER = 58

/** WinAnsi beyond Latin-1: what the built-in fonts can draw in 0x80–0x9F. */
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ')
const REPLACE: Record<string, string> = { '−': '-', ' ': ' ', ' ': ' ', '≈': '~', '→': '->' }

/**
 * The built-in fonts only know WinAnsi, which has €, ×, ÷ and · but not the
 * true minus sign, so anything outside it is swapped for its nearest
 * equivalent rather than printed as a blank box.
 */
export function pdfSafe(text: string): string {
  let out = ''
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(ch) || ch === '\n') out += ch
    else out += REPLACE[ch] ?? '?'
  }
  return out
}

export function reportPdf(report: Report): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
  doc.setProperties({ title: pdfSafe(report.title), subject: 'Deal report', creator: 'TinyPercent' })
  let y = MARGIN

  const ink = (c: Rgb) => doc.setTextColor(c[0], c[1], c[2])
  const paint = (c: Rgb) => doc.setFillColor(c[0], c[1], c[2])
  const stroke = (c: Rgb) => doc.setDrawColor(c[0], c[1], c[2])
  const font = (size: number, weight: 'normal' | 'bold' = 'normal') => {
    doc.setFont('helvetica', weight)
    doc.setFontSize(size)
  }
  const write = (text: string, x: number, at: number, align: 'left' | 'right' = 'left') => doc.text(pdfSafe(text), x, at, { align })
  const wrap = (text: string, width: number): string[] => doc.splitTextToSize(pdfSafe(text), width) as string[]
  const rule = (at: number, x = MARGIN, width = WIDTH) => {
    stroke(RULE)
    doc.setLineWidth(0.6)
    doc.line(x, at, x + width, at)
  }
  /** Starts a new page when the next block would run into the footer. */
  const room = (height: number) => {
    if (y + height <= PAGE_H - FOOTER) return
    doc.addPage()
    y = MARGIN
  }
  const heading = (text: string, x = MARGIN) => {
    font(11, 'bold')
    ink(INK)
    write(text, x, y)
  }

  // Masthead: the wordmark, and what this is.
  font(13, 'bold')
  ink(INK)
  write('tiny', MARGIN, y + 10)
  const tiny = doc.getTextWidth('tiny')
  ink(ACCENT)
  write('percent', MARGIN + tiny, y + 10)
  font(9)
  ink(FAINT)
  write(`Deal report · ${report.generated}`, PAGE_W - MARGIN, y + 10, 'right')
  y += 22
  rule(y)
  y += 30

  // Title and the deal in one line.
  y += 10
  font(22, 'bold')
  ink(INK)
  for (const line of wrap(report.title, WIDTH)) {
    doc.text(line, MARGIN, y)
    y += 26
  }
  font(10.5)
  ink(SOFT)
  for (const line of wrap(report.subtitle, WIDTH)) {
    doc.text(line, MARGIN, y - 6)
    y += 14
  }
  y += 14

  // The headline figures, as tiles.
  const gap = 10
  const tileW = (WIDTH - gap * (report.headline.length - 1)) / report.headline.length
  const tileH = 52
  report.headline.forEach((tile, i) => {
    const x = MARGIN + i * (tileW + gap)
    paint(tile.tone === 'gain' ? WASH : SUNK)
    doc.roundedRect(x, y, tileW, tileH, 6, 6, 'F')
    font(8)
    ink(FAINT)
    write(wrap(tile.label, tileW - 24)[0] ?? '', x + 12, y + 17)
    let size = 15
    font(size, 'bold')
    while (size > 8 && doc.getTextWidth(pdfSafe(tile.value)) > tileW - 24) {
      size -= 0.5
      font(size, 'bold')
    }
    ink(tile.tone === 'gain' ? GAIN : tile.tone === 'dilute' ? DILUTE : INK)
    write(tile.value, x + 12, y + 38)
  })
  y += tileH + 24

  // Terms and summary, side by side.
  const colGap = 28
  const colW = (WIDTH - colGap) / 2
  const pairs = (rows: Array<[string, string]>, x: number, top: number): number => {
    let at = top + 16
    for (const [label, value] of rows) {
      font(9)
      const labelW = doc.getTextWidth(pdfSafe(label))
      const valueLines = wrap(value, Math.max(colW - labelW - 12, colW * 0.45))
      ink(FAINT)
      write(label, x, at)
      ink(INK)
      valueLines.forEach((line, i) => doc.text(line, x + colW, at + i * 12, { align: 'right' }))
      at += 12 * (valueLines.length - 1) + 5
      rule(at, x, colW)
      at += 11
    }
    return at
  }
  heading('Your terms')
  heading('Summary', MARGIN + colW + colGap)
  const top = y
  y = Math.max(pairs(report.terms, MARGIN, top), pairs(report.summary, MARGIN + colW + colGap, top)) + 6

  // Where a SAFE or note stands, highlighted the way the site marks a key idea.
  if (report.status) {
    font(9.5)
    const lines = wrap(report.status, WIDTH - 12)
    room(lines.length * 14 + 10)
    for (const line of lines) {
      paint(MARKER)
      doc.roundedRect(MARGIN - 3, y - 9.5, doc.getTextWidth(line) + 6, 13, 2, 2, 'F')
      ink(INK)
      doc.text(line, MARGIN, y)
      y += 14
    }
    y += 8
  }

  if (report.caution) {
    font(9)
    const lines = wrap(report.caution, WIDTH - 16)
    room(lines.length * 12 + 14)
    paint(DILUTE)
    doc.rect(MARGIN, y - 9, 2, lines.length * 12 + 4, 'F')
    ink(SOFT)
    lines.forEach((line, i) => doc.text(line, MARGIN + 10, y + i * 12))
    y += lines.length * 12 + 14
  }

  const table = (title: string, t: Table, widths: number[]) => {
    // A short table moves to the next page whole rather than splitting.
    room(t.rows.length <= 6 ? 52 + t.rows.reduce((h, r) => h + (r.note ? 25 : 18), 0) : 60)
    y += 10
    heading(title)
    y += 18
    const xs = widths.reduce<number[]>((acc, w, i) => [...acc, (acc[i] ?? MARGIN) + w * WIDTH], [MARGIN])
    const header = () => {
      font(7, 'bold')
      ink(FAINT)
      t.columns.forEach((c, i) => write(c.toUpperCase(), i === 0 ? MARGIN : (xs[i + 1] ?? 0) - 4, y, i === 0 ? 'left' : 'right'))
      y += 6
      stroke(RULE)
      doc.setLineWidth(0.9)
      doc.line(MARGIN, y, MARGIN + WIDTH, y)
      y += 14
    }
    header()
    for (const row of t.rows) {
      const height = row.note ? 25 : 18
      if (y + height > PAGE_H - FOOTER) {
        doc.addPage()
        y = MARGIN
        header()
      }
      if (row.emphasis) {
        paint(WASH)
        doc.rect(MARGIN, y - 12, WIDTH, height, 'F')
      }
      row.cells.forEach((cell, i) => {
        font(9, i === 0 || row.emphasis ? 'bold' : 'normal')
        ink(i === 0 ? INK : row.emphasis ? ACCENT : INK)
        if (i === 0) write(wrap(cell, (widths[0] ?? 0.3) * WIDTH - 8)[0] ?? '', MARGIN + 4, y)
        else write(cell, (xs[i + 1] ?? 0) - 4, y, 'right')
      })
      if (row.note) {
        font(7.5)
        ink(FAINT)
        write(wrap(row.note, (widths[0] ?? 0.3) * WIDTH * 1.6)[0] ?? '', MARGIN + 4, y + 10)
      }
      y += height - 12
      rule(y)
      y += 12
    }
  }

  if (report.rounds) table('Your stake, round by round', report.rounds, [0.25, 0.14, 0.16, 0.14, 0.12, 0.19])
  if (report.endings) {
    const n = report.endings.columns.length
    table('How it could end', report.endings, n === 5 ? [0.3, 0.18, 0.18, 0.18, 0.16] : [0.34, 0.22, 0.24, 0.2])
  }

  // Disclaimer and page numbers on every page.
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    rule(PAGE_H - FOOTER + 8)
    font(7)
    ink(FAINT)
    wrap(report.disclaimer, WIDTH - 60).forEach((line, i) => doc.text(line, MARGIN, PAGE_H - FOOTER + 22 + i * 9))
    write(`${page} / ${pages}`, PAGE_W - MARGIN, PAGE_H - FOOTER + 22, 'right')
  }
  return doc
}

export function downloadReport(report: Report, fileName: string): void {
  reportPdf(report).save(fileName)
}
