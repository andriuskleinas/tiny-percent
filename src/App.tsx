import { ENGINE_VERSION } from './engine'

/**
 * Placeholder shell. The five real screens land in phase 04; this exists so the
 * scaffold is verifiably alive and the palette is wired end to end.
 */
export default function App() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
        Phase 00 · scaffold
      </p>
      <h1 className="mt-5 text-4xl font-medium tracking-tight text-ink">
        Angel Dilution Calculator
      </h1>
      <p className="mt-4 max-w-prose text-ink-soft">
        What your cheque buys, what the next rounds take back, and what survives the
        syndicate&rsquo;s carry.
      </p>
      <dl className="mt-10 border-t border-rule">
        {[
          ['Engine version', String(ENGINE_VERSION)],
          ['Next phase', '01 — ownership engine'],
          ['Golden cases green', '0 of 11'],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between border-b border-rule py-3">
            <dt className="text-sm text-ink-faint">{label}</dt>
            <dd className="font-mono text-sm text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </main>
  )
}
