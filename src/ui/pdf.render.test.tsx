// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from '../App'
import { setAnalyticsSink } from '../analytics/track'
import type { AnalyticsEvent } from '../analytics/track'
import { WORKED_EXAMPLE } from '../state/presets'
import { encodeScenario } from '../state/url'

/** The PDF is made in the browser from the deal on screen; the library is mocked here. */

const downloadReport = vi.fn()
vi.mock('./report/pdf', () => ({ downloadReport: (...args: unknown[]) => downloadReport(...args) }))

afterEach(() => {
  cleanup()
  setAnalyticsSink(undefined)
  downloadReport.mockReset()
  window.history.replaceState(null, '', '/')
})

describe('download PDF', () => {
  it('saves the calculation on screen, named after its round', async () => {
    const events: AnalyticsEvent[] = []
    setAnalyticsSink((e) => events.push(e))
    window.history.replaceState(null, '', `/#s=${encodeScenario(WORKED_EXAMPLE)}`)
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }))
    await waitFor(() => expect(downloadReport).toHaveBeenCalledOnce())
    const [report, fileName] = downloadReport.mock.calls[0] as [{ title: string }, string]
    expect(report.title).toMatch(/^\$50,000 into /)
    expect(fileName).toMatch(/^tinypercent-[a-z-]+-\d{4}-\d{2}-\d{2}\.pdf$/)
    expect(events.map((e) => e.name)).toContain('pdf_downloaded')
  })

  it('says so when the PDF cannot be made', async () => {
    downloadReport.mockImplementation(() => {
      throw new Error('no memory')
    })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }))
    expect((await screen.findByRole('alert')).textContent).toBe('The PDF could not be made. Please try again.')
  })

  it('is not offered before there is a deal to print', () => {
    window.history.replaceState(null, '', '/')
    render(<App />)
    // The starting point has a cheque and a valuation, so the button is there;
    // clearing the cheque takes it away.
    fireEvent.change(screen.getByLabelText('Investment amount'), { target: { value: '' } })
    expect(screen.queryByRole('button', { name: 'Download PDF' })).toBeNull()
  })
})
