/**
 * The waiting-list endpoint, as a plain function from a Request to a Response so
 * it runs the same in the Vite dev server, in tests and in any host that speaks
 * Request/Response. It checks what the form sent and passes it to a Google Apps Script web
 * app that appends a row to a spreadsheet (`tools/waitlist-apps-script.gs`).
 *
 * The script's address and shared secret live only in server environment
 * variables, so a visitor's browser never sees where the sheet is.
 */

export interface WaitlistConfig {
  /** The Apps Script web app's `/exec` URL. */
  scriptUrl?: string | undefined
  /** Must match `SECRET` in the Apps Script, so only this server can write rows. */
  secret?: string | undefined
}

export interface Signup {
  firstName: string
  lastName: string
  email: string
}

export type SignupField = keyof Signup

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MAX_NAME = 80
const MAX_EMAIL = 254
const MAX_BODY = 2_000

/** True when the text holds a control character (tab, newline, NUL and the like). */
function hasControl(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0)
    if (code < 32 || code === 127) return true
  }
  return false
}

/** The checks the form and the server share, so both reject the same input. */
export function validateSignup(input: { firstName?: unknown; lastName?: unknown; email?: unknown }):
  | { ok: true; signup: Signup }
  | { ok: false; fields: SignupField[] } {
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
  const firstName = text(input.firstName)
  const lastName = text(input.lastName)
  const email = text(input.email).toLowerCase()
  const name = (value: string) => value.length > 0 && value.length <= MAX_NAME && !hasControl(value)
  const fields: SignupField[] = []
  if (!name(firstName)) fields.push('firstName')
  if (!name(lastName)) fields.push('lastName')
  if (email.length > MAX_EMAIL || !EMAIL.test(email) || hasControl(email)) fields.push('email')
  return fields.length > 0 ? { ok: false, fields } : { ok: true, signup: { firstName, lastName, email } }
}

/**
 * A spreadsheet treats a cell starting with `=`, `+`, `-` or `@` as a formula.
 * Anything a stranger typed is stored as text instead.
 */
export function asSheetText(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value
}

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })

export async function handleWaitlist(
  request: Request,
  config: WaitlistConfig,
  send: typeof fetch = fetch,
  now: () => Date = () => new Date(),
): Promise<Response> {
  if (request.method !== 'POST') return reply(405, { ok: false, error: 'method' })

  const raw = await request.text()
  if (raw.length > MAX_BODY) return reply(413, { ok: false, error: 'too_large' })
  let body: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) throw new TypeError('not an object')
    body = parsed as Record<string, unknown>
  } catch {
    return reply(400, { ok: false, error: 'invalid', fields: ['firstName', 'lastName', 'email'] })
  }

  // A field people never see. Bots fill it in; they are told it worked.
  const trap = body['website']
  if (typeof trap === 'string' && trap.trim() !== '') return reply(200, { ok: true })

  const checked = validateSignup(body)
  if (!checked.ok) return reply(400, { ok: false, error: 'invalid', fields: checked.fields })

  if (!config.scriptUrl || !config.secret) return reply(503, { ok: false, error: 'unavailable' })

  const { firstName, lastName, email } = checked.signup
  try {
    const upstream = await send(config.scriptUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        secret: config.secret,
        firstName: asSheetText(firstName),
        lastName: asSheetText(lastName),
        email: asSheetText(email),
        source: 'tinypercent',
        submittedAt: now().toISOString(),
      }),
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    })
    const result = (await upstream.json().catch(() => undefined)) as { ok?: unknown } | undefined
    if (!upstream.ok || result?.ok !== true) return reply(502, { ok: false, error: 'upstream' })
  } catch {
    return reply(502, { ok: false, error: 'upstream' })
  }
  return reply(200, { ok: true })
}
