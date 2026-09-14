import { useMoney } from '../currency'
import type { RoundState } from '../../engine/scenario'
import { InfoTip } from '../controls'
import { ownership, roundName } from '../format'

/**
 * Round by round: the company's valuation, your ownership, and the paper value
 * of your stake, always side by side. A table from small screens up; stacked
 * cards on a phone, where six columns would not fit.
 */
export function DilutionTable({ states }: { states: RoundState[] }) {
  const { money } = useMoney()
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
        <caption className="mb-2 text-left font-mono text-[10px] uppercase tracking-wider text-ink-faint">
          Your stake, round by round
        </caption>
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
        </tbody>
      </table>

      <ol className="flex flex-col gap-2 sm:hidden" aria-label="Your stake, round by round">
        {rows.map((s) => (
          <li key={s.round.id} className="border border-rule p-3">
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
      </ol>
      <p className="mt-2 text-xs text-ink-faint">
        Paper value is implied by each round&rsquo;s valuation. It is not a price you could necessarily sell at.
      </p>
    </div>
  )
}
