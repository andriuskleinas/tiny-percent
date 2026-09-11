import { useId } from 'react'
import type { ReactNode } from 'react'
import { toCents, toMajor } from '../../engine/money'

/**
 * Form controls. Every input is labelled, focusable and keyboard-reachable.
 * Money crosses this boundary in cents and is shown in major units; percentages
 * cross as fractions and are shown as percentages. The engine never sees either
 * conversion.
 */

const inputClass =
  'w-full border border-rule bg-surface px-3 py-2 font-mono text-sm tabular-nums text-ink ' +
  'outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30'

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string | undefined
  children: (id: string) => ReactNode
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        {label}
      </label>
      {children(id)}
      {hint ? <p className="text-xs text-ink-faint">{hint}</p> : null}
    </div>
  )
}

export function MoneyField({
  label,
  hint,
  valueCents,
  onChange,
  symbol = '$',
}: {
  label: string
  hint?: string | undefined
  valueCents: number
  onChange: (cents: number) => void
  symbol?: string
}) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <div className="flex items-stretch">
          <span className="flex items-center border border-r-0 border-rule bg-sunk px-2.5 font-mono text-sm text-ink-faint">
            {symbol}
          </span>
          <input
            id={id}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            className={inputClass}
            value={toMajor(valueCents)}
            onChange={(e) => onChange(toCents(Number(e.target.value) || 0))}
          />
        </div>
      )}
    </Field>
  )
}

export function PercentField({
  label,
  hint,
  value,
  onChange,
  max = 100,
}: {
  label: string
  hint?: string | undefined
  value: number
  onChange: (fraction: number) => void
  max?: number
}) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <div className="flex items-stretch">
          <input
            id={id}
            type="number"
            inputMode="decimal"
            min={0}
            max={max}
            step="any"
            className={inputClass}
            value={Number((value * 100).toFixed(4))}
            onChange={(e) => onChange((Number(e.target.value) || 0) / 100)}
          />
          <span className="flex items-center border border-l-0 border-rule bg-sunk px-2.5 font-mono text-sm text-ink-faint">
            %
          </span>
        </div>
      )}
    </Field>
  )
}

export function TextField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'date'
}) {
  return (
    <Field label={label}>
      {(id) => (
        <input
          id={id}
          type={type}
          className={inputClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  )
}

export function SelectField<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string
  hint?: string | undefined
  value: T
  options: ReadonlyArray<readonly [T, string]>
  onChange: (value: T) => void
}) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <select
          id={id}
          className={`${inputClass} font-sans`}
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
        >
          {options.map(([key, text]) => (
            <option key={key} value={key}>
              {text}
            </option>
          ))}
        </select>
      )}
    </Field>
  )
}

export function Panel({
  title,
  lede,
  children,
  aside,
}: {
  title: string
  lede?: string | undefined
  children: ReactNode
  aside?: ReactNode | undefined
}) {
  return (
    <section className="border border-rule bg-surface">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {lede ? <p className="mt-1 max-w-prose text-sm text-ink-soft">{lede}</p> : null}
        </div>
        {aside}
      </header>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  )
}

export function Stat({
  label,
  value,
  tone = 'ink',
  sub,
}: {
  label: string
  value: string
  tone?: 'ink' | 'gain' | 'dilute' | 'soft'
  sub?: string | undefined
}) {
  const colour =
    tone === 'gain' ? 'text-gain' : tone === 'dilute' ? 'text-dilute' : tone === 'soft' ? 'text-ink-soft' : 'text-ink'
  return (
    <div className="border-t border-rule py-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{label}</p>
      <p className={`mt-1 font-mono text-base tabular-nums ${colour}`}>{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-ink-faint">{sub}</p> : null}
    </div>
  )
}

export function Button({
  children,
  onClick,
  tone = 'default',
  title,
}: {
  children: ReactNode
  onClick: () => void
  tone?: 'default' | 'quiet'
  title?: string | undefined
}) {
  const base =
    'border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ' +
    'outline-none focus-visible:ring-2 focus-visible:ring-accent/40'
  const look =
    tone === 'quiet'
      ? 'border-rule text-ink-faint hover:border-rule-strong hover:text-ink'
      : 'border-accent text-accent hover:bg-accent-wash'
  return (
    <button type="button" title={title} onClick={onClick} className={`${base} ${look}`}>
      {children}
    </button>
  )
}
