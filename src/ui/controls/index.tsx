import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useMoney } from '../currency'
import { moneyInputText, parseMoney } from '../format'
import { GLOSSARY } from '../glossary'
import type { TermKey } from '../glossary'

/**
 * Form controls. Every input is labelled, focusable and keyboard-reachable.
 * Money crosses this boundary in cents and is shown in major units; percentages
 * cross as fractions and are shown as percentages. The engine never sees either
 * conversion.
 */

const inputClass =
  'w-full border border-rule bg-surface px-3 py-2 font-mono text-sm tabular-nums text-ink ' +
  'outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30'

/**
 * A term's explanation, behind a small button beside the thing it explains.
 * It is a disclosure rather than a hover tooltip, so it works by keyboard and
 * touch alike: Enter or a tap opens it, Escape or a click elsewhere closes it,
 * and the text sits right after the button in reading order.
 */
export function InfoTip({ term }: { term: TermKey }) {
  const { question, body } = GLOSSARY[term]
  const [open, setOpen] = useState(false)
  const [shift, setShift] = useState(0)
  const id = useId()
  const wrapper = useRef<HTMLSpanElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const note = useRef<HTMLSpanElement>(null)

  // Centred under its button unless that would push it off a narrow screen,
  // in which case it slides sideways just enough to stay inside.
  useLayoutEffect(() => {
    if (!open || !note.current) {
      setShift(0)
      return
    }
    const margin = 8
    const box = note.current.getBoundingClientRect()
    const left = box.left - shift
    const right = box.right - shift
    const width = document.documentElement.clientWidth
    setShift(left < margin ? margin - left : right > width - margin ? width - margin - right : 0)
    // Measured once per opening; `shift` is deliberately not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        button.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span ref={wrapper} className="relative inline-flex align-middle normal-case tracking-normal">
      <button
        ref={button}
        type="button"
        aria-label={question}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((was) => !was)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-rule-strong font-sans text-[10px] font-semibold leading-none text-ink-faint outline-none transition-colors hover:border-accent hover:text-accent focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        i
      </button>
      <span
        ref={note}
        id={id}
        role="note"
        hidden={!open}
        style={{ transform: `translateX(calc(-50% + ${shift}px))` }}
        className="absolute left-1/2 top-6 z-30 w-64 max-w-[calc(100vw-1rem)] border border-rule-strong bg-surface p-3 text-left font-sans text-xs leading-relaxed text-ink-soft shadow-lg"
      >
        <span className="mb-1 block font-semibold text-ink">{question}</span>
        {body}
      </span>
    </span>
  )
}

export function Field({
  label,
  hint,
  info,
  id: fixedId,
  children,
}: {
  label: string
  hint?: string | undefined
  info?: TermKey | undefined
  /** A stable id, for an input something else needs to focus. */
  id?: string | undefined
  children: (id: string) => ReactNode
}) {
  const generated = useId()
  const id = fixedId ?? generated
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <label htmlFor={id} className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
          {label}
        </label>
        {info ? <InfoTip term={info} /> : null}
      </div>
      {children(id)}
      {hint ? <p className="text-xs text-ink-faint">{hint}</p> : null}
    </div>
  )
}

/**
 * Money is typed as text so it can carry thousands separators — 24000000 is
 * easy to misread by ten times — and the shorthand people say out loud, "5k"
 * or "4m". While the field has focus it shows exactly what was typed; on blur
 * it is rewritten with separators.
 */
export function MoneyField({
  label,
  hint,
  info,
  valueCents,
  onChange,
  placeholder,
  id,
}: {
  label: string
  hint?: string | undefined
  info?: TermKey | undefined
  valueCents: number
  onChange: (cents: number) => void
  placeholder?: string | undefined
  id?: string | undefined
}) {
  const { symbol } = useMoney()
  const [draft, setDraft] = useState<string | undefined>(undefined)
  const invalid = draft !== undefined && draft.trim() !== '' && parseMoney(draft) === undefined

  return (
    <Field label={label} hint={invalid ? 'Type an amount, like 5000, 5k or 1.5m.' : hint} info={info} id={id}>
      {(id) => (
        <div className="flex items-stretch">
          <span className="flex items-center border border-r-0 border-rule bg-sunk px-2.5 font-mono text-sm text-ink-faint">
            {symbol}
          </span>
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            placeholder={placeholder ?? '0'}
            aria-invalid={invalid || undefined}
            className={inputClass}
            value={draft ?? moneyInputText(valueCents)}
            onChange={(e) => {
              setDraft(e.target.value)
              const cents = e.target.value.trim() === '' ? 0 : parseMoney(e.target.value)
              if (cents !== undefined) onChange(cents)
            }}
            onBlur={() => setDraft(undefined)}
          />
        </div>
      )}
    </Field>
  )
}

export function PercentField({
  label,
  hint,
  info,
  value,
  onChange,
  max = 100,
}: {
  label: string
  hint?: string | undefined
  info?: TermKey | undefined
  value: number
  onChange: (fraction: number) => void
  max?: number
}) {
  return (
    <Field label={label} hint={hint} info={info}>
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

export function NumberField({
  label,
  hint,
  value,
  onChange,
  min = 0,
  max,
}: {
  label: string
  hint?: string | undefined
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number | undefined
}) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step="any"
          className={inputClass}
          value={value}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
        />
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

export function SwitchField<T extends string>({
  label,
  hint,
  info,
  value,
  options,
  onChange,
}: {
  label: string
  hint?: string | undefined
  info?: TermKey | undefined
  value: T
  options: readonly [readonly [T, string], readonly [T, string]]
  onChange: (value: T) => void
}) {
  return (
    <Field label={label} hint={hint} info={info}>
      {(id) => (
        <div id={id} role="radiogroup" aria-label={label} className="flex border border-rule">
          {options.map(([key, text]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={value === key}
              onClick={() => onChange(key)}
              className={`flex-1 border-rule px-3 py-2 font-mono text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 ${
                key === options[0][0] ? 'border-r' : ''
              } ${value === key ? 'bg-accent text-on-accent' : 'bg-surface text-ink-faint hover:text-ink'}`}
            >
              {text}
            </button>
          ))}
        </div>
      )}
    </Field>
  )
}

/**
 * A row of mutually exclusive choices, such as the exit valuations. Arrow keys
 * move between them, as in any radio group.
 */
export function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  /** Undefined when none of the options is the current value. */
  value: T | undefined
  options: ReadonlyArray<readonly [T, string]>
  onChange: (value: T) => void
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const current = options.findIndex(([key]) => key === value)
  const move = (from: number, step: number) => {
    const next = (from + step + options.length) % options.length
    const option = options[next]
    if (!option) return
    onChange(option[0])
    refs.current[next]?.focus()
  }
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map(([key, text], i) => {
        const checked = key === value
        return (
          <button
            key={key}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked || (current === -1 && i === 0) ? 0 : -1}
            onClick={() => onChange(key)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault()
                move(i, 1)
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault()
                move(i, -1)
              }
            }}
            className={`border px-3 py-1.5 font-mono text-sm tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 ${
              checked ? 'border-accent bg-accent text-on-accent' : 'border-rule bg-surface text-ink-soft hover:border-rule-strong hover:text-ink'
            }`}
          >
            {text}
          </button>
        )
      })}
    </div>
  )
}

/** Optional detail, closed unless it already holds something that matters. */
export function Disclosure({
  summary,
  defaultOpen = false,
  children,
}: {
  summary: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  return (
    <details open={defaultOpen} className="group border border-rule">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-ink-soft outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/40 [&::-webkit-details-marker]:hidden">
        {summary}
        <span aria-hidden="true" className="font-mono text-ink-faint transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="border-t border-rule px-4 py-4">{children}</div>
    </details>
  )
}

export function Panel({
  title,
  lede,
  children,
  aside,
  id,
}: {
  title: string
  lede?: string | undefined
  children: ReactNode
  aside?: ReactNode | undefined
  id?: string | undefined
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className="scroll-mt-20 border border-rule bg-surface">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule px-5 py-4 sm:px-6">
        <div>
          <h2 id={id ? `${id}-title` : undefined} className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
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
  info,
  size = 'base',
}: {
  label: string
  value: string
  tone?: 'ink' | 'gain' | 'dilute' | 'soft'
  sub?: string | undefined
  info?: TermKey | undefined
  size?: 'base' | 'large'
}) {
  const colour =
    tone === 'gain' ? 'text-gain' : tone === 'dilute' ? 'text-dilute' : tone === 'soft' ? 'text-ink-soft' : 'text-ink'
  return (
    <div className="border-t border-rule py-3">
      <div className="flex items-center gap-1.5">
        <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{label}</p>
        {info ? <InfoTip term={info} /> : null}
      </div>
      <p className={`mt-1 font-mono tabular-nums ${size === 'large' ? 'text-2xl font-semibold tracking-tight' : 'text-base'} ${colour}`}>
        {value}
      </p>
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
  tone?: 'default' | 'quiet' | 'primary'
  title?: string | undefined
}) {
  const base =
    'border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ' +
    'outline-none focus-visible:ring-2 focus-visible:ring-accent/40'
  const look =
    tone === 'quiet'
      ? 'border-rule text-ink-faint hover:border-rule-strong hover:text-ink'
      : tone === 'primary'
        ? 'border-accent bg-accent text-on-accent hover:opacity-90'
        : 'border-accent text-accent hover:bg-accent-wash'
  return (
    <button type="button" title={title} onClick={onClick} className={`${base} ${look}`}>
      {children}
    </button>
  )
}
