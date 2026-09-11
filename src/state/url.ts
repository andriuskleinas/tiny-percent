import type { CarryTerms, EntryFeeTerms, ManagementFeeTerms } from '../engine/fees'
import type {
  AngelAction,
  Currency,
  ExitEvent,
  Instrument,
  InstrumentType,
  Round,
  Scenario,
} from '../engine/types'

/**
 * A scenario travels in the link, which means it arrives as untrusted input from
 * whoever sent it. Everything here validates structurally rather than casting: a
 * malformed or hostile link is refused, never half-applied.
 */

const CURRENCIES: readonly string[] = ['USD', 'EUR', 'GBP']
const INSTRUMENTS: readonly string[] = [
  'equity',
  'safe_post',
  'safe_pre',
  'cla',
  'asa',
  'kiss_equity',
  'kiss_debt',
]

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

function isAngelAction(value: unknown): value is AngelAction {
  if (!isObject(value)) return false
  if (value['kind'] === 'sit_out' || value['kind'] === 'pro_rata') return true
  return value['kind'] === 'custom' && isAmount(value['amountCents'])
}

function isInstrument(value: unknown): value is Instrument {
  if (!isObject(value)) return false
  return (
    INSTRUMENTS.includes(value['type'] as InstrumentType) &&
    isAmount(value['amountCents']) &&
    isDate(value['date']) &&
    optional(value['capCents'], isAmount) &&
    optional(value['discount'], isFraction) &&
    optional(value['interestRate'], isFraction) &&
    (value['interestMode'] === undefined ||
      value['interestMode'] === 'simple' ||
      value['interestMode'] === 'compound') &&
    optional(value['maturityDate'], isDate) &&
    optional(value['otherConvertingCents'], isAmount)
  )
}

function isRound(value: unknown): value is Round {
  if (!isObject(value)) return false
  return (
    isText(value['id']) &&
    isText(value['label']) &&
    isDate(value['date']) &&
    isAmount(value['raisedCents']) &&
    // A pre-money of zero would divide by zero in the very first calculation.
    isAmount(value['preMoneyCents']) &&
    (value['preMoneyCents'] as number) > 0 &&
    optional(value['newOptionPool'], isFraction) &&
    (value['convertsHere'] === undefined || typeof value['convertsHere'] === 'boolean') &&
    isAngelAction(value['angelAction'])
  )
}

function isEntryFee(value: unknown): value is EntryFeeTerms {
  if (!isObject(value)) return false
  return (
    ['percent', 'fixed', 'greater_of'].includes(value['rule'] as string) &&
    ['on_top', 'deducted'].includes(value['charged'] as string) &&
    optional(value['percent'], isFraction) &&
    optional(value['fixedCents'], isAmount)
  )
}

function isManagementFee(value: unknown): value is ManagementFeeTerms {
  if (!isObject(value)) return false
  return (
    isFraction(value['annualPercent']) &&
    typeof value['years'] === 'number' &&
    Number.isFinite(value['years']) &&
    value['years'] >= 0 &&
    ['capital', 'invoiced'].includes(value['source'] as string)
  )
}

function isCarry(value: unknown): value is CarryTerms {
  if (!isObject(value)) return false
  return (
    isFraction(value['percent']) &&
    value['basis'] === 'per_deal' &&
    (value['hurdlePercent'] === undefined ||
      (typeof value['hurdlePercent'] === 'number' &&
        Number.isFinite(value['hurdlePercent']) &&
        value['hurdlePercent'] >= 0))
  )
}

function isExit(value: unknown): value is ExitEvent {
  if (!isObject(value)) return false
  return (
    isDate(value['date']) &&
    isAmount(value['valueCents']) &&
    isAmount(value['totalRaisedCents']) &&
    (value['unconvertedLoan'] === undefined ||
      ['convert', 'repay', 'extend'].includes(value['unconvertedLoan'] as string))
  )
}

export function isScenario(value: unknown): value is Scenario {
  if (!isObject(value)) return false
  if (value['version'] !== 1) return false
  if (!CURRENCIES.includes(value['currency'] as Currency)) return false
  if (!isInstrument(value['entry'])) return false
  const rounds = value['rounds']
  if (!Array.isArray(rounds) || rounds.length === 0 || rounds.length > 30) return false
  if (!rounds.every(isRound)) return false
  const fees = value['fees']
  if (!isObject(fees)) return false
  if (!isEntryFee(fees['entry'])) return false
  if (!isCarry(fees['carry'])) return false
  if (fees['management'] !== undefined && !isManagementFee(fees['management'])) return false
  return isExit(value['exit'])
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array | undefined {
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
  if (!bytes) return undefined
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

const PREFIX = '#s='

export function scenarioFromLocation(hash: string): Scenario | undefined {
  return hash.startsWith(PREFIX) ? decodeScenario(hash.slice(PREFIX.length)) : undefined
}

export function linkFor(scenario: Scenario, base: string): string {
  return `${base.split('#')[0] ?? base}${PREFIX}${encodeScenario(scenario)}`
}
