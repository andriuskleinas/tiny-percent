import { useMoney } from '../currency'
import type { RoundState } from '../../engine/scenario'
import { InfoTip } from '../controls'
import { multiple, ownership, percent, roundName } from '../format'

/** The hypothetical sale at the end of the table, at the exit valuation on the slider. */
export interface ExitRow {
  valueCents: number
  date: string
  finalOwnership: number
  grossLowCents: number
  grossHighCents: number
  netLowCents: number
  netHighCents: number
  multipleLow: number
  multipleHigh: number
  /** Share of profit taken as carry; 0 when none. */
  carryPercent: number
  /** Whether liquidation preferences could decide the proceeds. */
  preferences: boolean
}

/**
 * Round by round: the company's valuation, your ownership, and the paper value
 * of your stake, always side by side. A table from small screens up; stacked
 * cards on a phone, where six columns would not fit.
 */
export function DilutionTable({ states, exit }: { states: RoundState[]; exit?: ExitRow | undefined }) {
  const { money, compactMoney } = useMoney()
  const range = (low: string, high: string) => (low === high ? high : `${low} – ${high}`)
  const net = exit && exit.netHighCents !== exit.grossHighCents ? range(money(exit.netLowCents), money(exit.netHighCents)) : undefined
  const exitName = exit ? `Exit at ${compactMoney(exit.valueCents)}` : ''
  const rows = states.filter((s) => s.ownershipAfter > 0 || s.investedCents > 0)

  const change = (s: RoundState) => {
    if (s.ownershipBefore === 0) return 'entry'
    const delta = s.ownershipAfter / s.ownershipBefore - 1
    if (Math.abs(delta) < 1e-9) return 'held'
    return `${delta > 0 ? '+' : '−'}${Math.abs(delta * 100).toFixed(1)}%`
  }

  return (
    <div>
      <table className="hidden w-full border-collapse text-sm sm:table">
        <caption className="sr-only">Your stake, round by round</caption>
        <thead>
          <tr className="border-b border-rule-strong text-left font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            <th scope="col" className="py-2 pr-3 font-normal">Round</th>
            <th scope="col" className="px-3 py-2 text-right font-normal">Post-money valuation</th>
            <th scope="col" className="px-3 py-2 text-right font-normal">Your cheque</th>
            <th scope="col" className="px-3 py-2 text-right font-normal">Your ownership</th>
            <th scope="col" className="px-3 py-2 text-right font-normal">Change</th>
            <th scope="col" className="py-2 pl-3 text-right font-normal">
              <span className="inline-flex items-center gap-1.5">
                Paper value <InfoTip term="paperValue" />
              </span>
            </th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {rows.map((s) => (
            <tr key={s.round.id} className="border-b border-rule">
              <th scope="row" className="py-2 pr-3 text-left font-sans font-medium text-ink">
                {roundName(s.round)}
                <span className="ml-2 font-mono text-[11px] font-normal text-ink-faint">{s.round.date.slice(0, 4)}</span>
              </th>
              <td className="px-3 py-2 text-right text-ink-soft">{money(s.postMoneyCents)}</td>
              <td className="px-3 py-2 text-right text-ink-soft">{s.investedCents > 0 ? money(s.investedCents) : '—'}</td>
              <td className="px-3 py-2 text-right text-ink">{ownership(s.ownershipAfter)}</td>
              <td className="px-3 py-2 text-right text-ink-faint">{change(s)}</td>
              <td className="py-2 pl-3 text-right text-gain">{money(s.stakeValueCents)}</td>
            </tr>
          ))}
          {exit ? (
            <tr className="border-b border-rule bg-accent-wash/50">
              <th scope="row" className="py-2.5 pr-3 text-left font-sans font-semibold text-ink">
                {exitName}
                <span className="ml-2 font-mono text-[11px] font-normal text-ink-faint">{exit.date.slice(0, 4)}</span>
              </th>
              <td className="px-3 py-2.5 text-right text-ink-soft">{money(exit.valueCents)}</td>
              <td className="px-3 py-2.5 text-right text-ink-soft">—</td>
              <td className="px-3 py-2.5 text-right text-ink">{ownership(exit.finalOwnership)}</td>
              <td className="px-3 py-2.5 text-right text-ink">{range(multiple(exit.multipleLow), multiple(exit.multipleHigh))}</td>
              <td className="py-2.5 pl-3 text-right">
                <span className="block font-semibold text-gain">{range(money(exit.grossLowCents), money(exit.grossHighCents))}</span>
                {net ? (
                  <span className="block text-[11px] text-ink-faint">
                    {net} after {percent(exit.carryPercent, 0)} carry
                  </span>
                ) : null}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <ol className="flex flex-col gap-2 sm:hidden" aria-label="Your stake, round by round">
        {rows.map((s) => (
          <li key={s.round.id} className="rounded-xl border border-rule p-3">
            <p className="flex justify-between text-sm font-medium text-ink">
              {roundName(s.round)}
              <span className="font-mono text-xs font-normal text-ink-faint">{change(s)}</span>
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-ink-faint">Valuation</dt>
              <dd className="text-right font-mono tabular-nums text-ink-soft">{money(s.postMoneyCents)}</dd>
              <dt className="text-ink-faint">Ownership</dt>
              <dd className="text-right font-mono tabular-nums text-ink">{ownership(s.ownershipAfter)}</dd>
              <dt className="text-ink-faint">Paper value</dt>
              <dd className="text-right font-mono tabular-nums text-gain">{money(s.stakeValueCents)}</dd>
              {s.investedCents > 0 ? (
                <>
                  <dt className="text-ink-faint">Your cheque</dt>
                  <dd className="text-right font-mono tabular-nums text-ink-soft">{money(s.investedCents)}</dd>
                </>
              ) : null}
            </dl>
          </li>
        ))}
        {exit ? (
          <li className="rounded-xl border border-accent/40 bg-accent-wash/50 p-3">
            <p className="flex justify-between text-sm font-semibold text-ink">
              {exitName}
              <span className="font-mono text-xs font-normal text-ink">{range(multiple(exit.multipleLow), multiple(exit.multipleHigh))}</span>
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-ink-faint">Ownership</dt>
              <dd className="text-right font-mono tabular-nums text-ink">{ownership(exit.finalOwnership)}</dd>
              <dt className="text-ink-faint">Proceeds</dt>
              <dd className="text-right font-mono tabular-nums text-gain">{range(money(exit.grossLowCents), money(exit.grossHighCents))}</dd>
              {net ? (
                <>
                  <dt className="text-ink-faint">After carry</dt>
                  <dd className="text-right font-mono tabular-nums text-ink">{net}</dd>
                </>
              ) : null}
            </dl>
          </li>
        ) : null}
      </ol>
      <p className="mt-2 text-xs text-ink-faint">
        Paper value is implied by each round&rsquo;s valuation. It is not a price you could necessarily sell at.
        {exit
          ? ` The exit row is a hypothetical sale at the exit valuation you chose. Its Change column shows your multiple on everything you invested${exit.carryPercent > 0 ? ', after carry' : ''}.${exit.preferences ? ' Near the capital raised, liquidation preferences decide where in the range you land.' : ''}`
          : ''}
      </p>
    </div>
  )
}
