import type { CarryTerms, EntryFeeTerms, ManagementFeeTerms } from '../engine/fees'
import type { Currency, ExitEvent, Instrument, InstrumentType, Round, Scenario } from '../engine/types'

/**
 * A scenario travels in the link, which means it arrives as untrusted input from
 * whoever sent it. Everything here validates structurally rather than casting: a
 * malformed or hostile link is refused, never half-applied.
 */

const CURRENCIES: readonly string[] = ['USD', 'EUR']
const INSTRUMENTS: readonly string[] = ['equity', 'safe', 'cla']
/** Round names are free text — "Seed", "Series A" or whatever the user calls it. */
export const MAX_LABEL_LENGTH = 40

function isLabel(value: unknown): value is string {
  // Empty is allowed: it is what a custom name looks like mid-edit.
  return typeof value === 'string' && value.length <= MAX_LABEL_LENGTH
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Finite, non-negative, and inside the range cents can hold exactly. */
function isAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER
}

function isFraction(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 200
}

function optional<T>(value: unknown, check: (v: unknown) => v is T): boolean {
  return value === undefined || check(value)
}

function isEntryFee(value: unknown): value is EntryFeeTerms {
  if (!isObject(value)) return false
  return (
    ['percent', 'fixed', 'greater_of'].includes(value['rule'] as string) &&
    optional(value['percent'], isFraction) &&
    optional(value['fixedCents'], isAmount)
  )
}

function isInstrument(value: unknown): value is Instrument {
  if (!isObject(value)) return false
  return (
    INSTRUMENTS.includes(value['type'] as InstrumentType) &&
    isAmount(value['amountCents']) &&
    isEntryFee(value['entryFee'])
  )
}

function isRound(value: unknown): value is Round {
  if (!isObject(value)) return false
  return (
    isText(value['id']) &&
    isLabel(value['label']) &&
    isDate(value['date']) &&
    isAmount(value['raisedCents']) &&
    // A zero valuation is a blank form. The engine refuses to price a cheque
    // against it, and the app falls back when a link cannot run.
    isAmount(value['valuationCents']) &&
    (value['valuationBasis'] === 'pre' || value['valuationBasis'] === 'post') &&
    optional(value['newOptionPool'], isFraction) &&
    optional(value['participation'], isInstrument)
  )
}

function isManagementFee(value: unknown): value is ManagementFeeTerms {
  if (!isObject(value)) return false
  return (
    isFraction(value['annualPercent']) &&
    typeof value['years'] === 'number' &&
    Number.isFinite(value['years']) &&
    value['years'] >= 0
  )
}

function isCarry(value: unknown): value is CarryTerms {
  if (!isObject(value)) return false
  return isFraction(value['percent']) && value['basis'] === 'per_deal'
}

function isExit(value: unknown): value is ExitEvent {
  if (!isObject(value)) return false
  return (
    isDate(value['date']) &&
    isAmount(value['valueCents']) &&
    isAmount(value['totalRaisedCents'])
  )
}

export function isScenario(value: unknown): value is Scenario {
  if (!isObject(value)) return false
  if (value['version'] !== 2) return false
  if (!CURRENCIES.includes(value['currency'] as Currency)) return false
  const rounds = value['rounds']
  if (!Array.isArray(rounds) || rounds.length === 0 || rounds.length > 30) return false
  if (!rounds.every(isRound)) return false
  // You cannot skip your own entry — the first round must always invest.
  if ((rounds[0] as Round | undefined)?.participation === undefined) return false
  const fees = value['fees']
  if (!isObject(fees)) return false
  if (!isCarry(fees['carry'])) return false
  if (fees['management'] !== undefined && !isManagementFee(fees['management'])) return false
  return isExit(value['exit'])
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | undefined {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) return undefined
  const padded = text.replace(/-/g, '+').replace(/_/g, '/')
  try {
    const binary = atob(padded)
    return Uint8Array.from(binary, (c) => c.charCodeAt(0))
  } catch {
    return undefined
  }
}

export function encodeScenario(scenario: Scenario): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(scenario)))
}

export function decodeScenario(encoded: string): Scenario | undefined {
  const bytes = fromBase64Url(encoded)
  return bytes ? decodeJson(bytes) : undefined
}

function decodeJson(bytes: Uint8Array): Scenario | undefined {
  let parsed: unknown
  try {
    // The reviver drops __proto__ so a crafted link cannot reach Object.prototype.
    parsed = JSON.parse(new TextDecoder().decode(bytes), (key, value) =>
      key === '__proto__' ? undefined : value,
    )
  } catch {
    return undefined
  }
  return isScenario(parsed) ? parsed : undefined
}

/** Links made before `/shared`: the scenario as plain base64 JSON after `#s=`. */
const PREFIX = '#s='

export function scenarioFromLocation(hash: string): Scenario | undefined {
  return hash.startsWith(PREFIX) ? decodeScenario(hash.slice(PREFIX.length)) : undefined
}

/**
 * Shared links look like `/shared#<code>`. The code is the scenario's JSON,
 * compressed and base64url-encoded, and stays after the `#` so it is never sent
 * to the server.
 */
export const SHARED_PATH = '/shared'

export function isSharedPath(pathname: string): boolean {
  return pathname === SHARED_PATH || pathname === `${SHARED_PATH}/`
}

/** True while the address still carries a shared calculation, in either style. */
export function carriesScenario(location: { pathname: string; hash: string }): boolean {
  return location.hash.startsWith(PREFIX) || (isSharedPath(location.pathname) && location.hash.length > 1)
}

/** A real scenario is a few kilobytes; anything that inflates past this is refused. */
const MAX_INFLATED_BYTES = 64 * 1024

async function readAll(stream: ReadableStream<Uint8Array>, limit: number): Promise<Uint8Array | undefined> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) {
      await reader.cancel()
      return undefined
    }
    chunks.push(value)
  }
  const out = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

function through(bytes: Uint8Array<ArrayBuffer>, transform: CompressionStream | DecompressionStream): ReadableStream<Uint8Array> {
  return new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  }).pipeThrough(transform)
}

export async function encodeShared(scenario: Scenario): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(scenario))
  const packed = await readAll(through(json, new CompressionStream('deflate-raw')), Number.MAX_SAFE_INTEGER)
  return toBase64Url(packed ?? new Uint8Array())
}

export async function decodeShared(encoded: string): Promise<Scenario | undefined> {
  const bytes = fromBase64Url(encoded)
  if (!bytes) return undefined
  try {
    const json = await readAll(through(bytes, new DecompressionStream('deflate-raw')), MAX_INFLATED_BYTES)
    return json ? decodeJson(json) : undefined
  } catch {
    return undefined
  }
}

/** The shared calculation in the address, whichever style of link brought it. */
export async function scenarioFromAddress(location: { pathname: string; hash: string }): Promise<Scenario | undefined> {
  if (location.hash.startsWith(PREFIX)) return scenarioFromLocation(location.hash)
  return isSharedPath(location.pathname) ? decodeShared(location.hash.slice(1)) : undefined
}

export async function sharedLink(scenario: Scenario, origin: string): Promise<string> {
  return `${origin}${SHARED_PATH}#${await encodeShared(scenario)}`
}
