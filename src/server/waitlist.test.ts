import { describe, expect, it, vi } from 'vitest'
import { asSheetText, handleWaitlist, validateSignup } from './waitlist'

const CONFIG = { scriptUrl: 'https://script.google.com/macros/s/abc/exec', secret: 's3cret' }
const NOW = () => new Date('2026-09-16T12:00:00Z')

const post = (body: unknown) =>
  new Request('https://tinypercent.com/api/waitlist', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

const sheetSays = (reply: unknown, status = 200) =>
  vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(reply), { status }))

const valid = { firstName: '  Ada ', lastName: 'Lovelace', email: ' Ada@Example.com ' }

describe('checking a signup', () => {
  it('trims names and lower-cases the email', () => {
    expect(validateSignup(valid)).toEqual({ ok: true, signup: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' } })
  })

  it('names every field that is missing or wrong', () => {
    expect(validateSignup({ firstName: '', lastName: 'x'.repeat(81), email: 'nope' })).toEqual({
      ok: false,
      fields: ['firstName', 'lastName', 'email'],
    })
    expect(validateSignup({ firstName: `A${String.fromCharCode(0)}B`, lastName: 'B', email: 'a@b.co' })).toEqual({
      ok: false,
      fields: ['firstName'],
    })
  })
})

describe('writing to a spreadsheet safely', () => {
  it('stores anything that looks like a formula as text', () => {
    expect(asSheetText('=HYPERLINK("x")')).toBe(`'=HYPERLINK("x")`)
    expect(asSheetText('+1')).toBe(`'+1`)
    expect(asSheetText('@me')).toBe(`'@me`)
    expect(asSheetText('Ada')).toBe('Ada')
  })
})

describe('the waiting-list endpoint', () => {
  it('passes a valid signup to the sheet with the secret, and says it worked', async () => {
    const send = sheetSays({ ok: true })
    const response = await handleWaitlist(post(valid), CONFIG, send, NOW)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    const [url, init] = send.mock.calls[0] ?? []
    expect(url).toBe(CONFIG.scriptUrl)
    expect(JSON.parse(String(init?.body))).toEqual({
      secret: 's3cret',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      source: 'tinypercent',
      submittedAt: '2026-09-16T12:00:00.000Z',
    })
  })

  it('rejects an invalid signup without contacting the sheet', async () => {
    const send = sheetSays({ ok: true })
    const response = await handleWaitlist(post({ firstName: 'Ada', lastName: '', email: 'x' }), CONFIG, send)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, error: 'invalid', fields: ['lastName', 'email'] })
    expect(send).not.toHaveBeenCalled()
  })

  it('tells a bot that filled the hidden field it worked, and stores nothing', async () => {
    const send = sheetSays({ ok: true })
    const response = await handleWaitlist(post({ ...valid, website: 'spam.example' }), CONFIG, send)
    expect(response.status).toBe(200)
    expect(send).not.toHaveBeenCalled()
  })

  it('says the list is unavailable when the sheet is not configured', async () => {
    const send = sheetSays({ ok: true })
    expect((await handleWaitlist(post(valid), {}, send)).status).toBe(503)
    expect(send).not.toHaveBeenCalled()
  })

  it('reports a failure when the sheet refuses, errors or cannot be reached', async () => {
    expect((await handleWaitlist(post(valid), CONFIG, sheetSays({ ok: false, error: 'unauthorised' }))).status).toBe(502)
    expect((await handleWaitlist(post(valid), CONFIG, sheetSays({ ok: true }, 500))).status).toBe(502)
    const down = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'))
    expect((await handleWaitlist(post(valid), CONFIG, down)).status).toBe(502)
  })

  it('only accepts a small JSON POST', async () => {
    expect((await handleWaitlist(new Request('https://x/api/waitlist'), CONFIG)).status).toBe(405)
    expect((await handleWaitlist(post('not json'), CONFIG)).status).toBe(400)
    expect((await handleWaitlist(post({ ...valid, firstName: 'x'.repeat(3_000) }), CONFIG)).status).toBe(413)
  })
})
