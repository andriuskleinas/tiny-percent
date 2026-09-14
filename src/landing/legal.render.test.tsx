// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { LegalPage } from './LegalPage'

afterEach(cleanup)

describe('the privacy page', () => {
  it('says what is and is not collected, accurately for today', () => {
    render(<LegalPage page="privacy" />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Privacy')
    const text = document.body.textContent ?? ''
    expect(text).toMatch(/no cookies/i)
    expect(text).toMatch(/runs in your browser/i)
    expect(text).toMatch(/Vercel/)
    expect(text).toMatch(/not switched on/i)
  })
})

describe('the terms page', () => {
  it('states the calculator is not advice and results are hypothetical', () => {
    render(<LegalPage page="terms" />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Terms of use')
    const text = document.body.textContent ?? ''
    expect(text).toMatch(/does not constitute investment, legal, tax or financial advice/)
    expect(text).toMatch(/hypothetical/)
  })

  it('links home to the calculator from both pages', () => {
    render(<LegalPage page="terms" />)
    expect(screen.getByRole('link', { name: 'Use calculator' }).getAttribute('href')).toBe('/#calculator')
  })
})
