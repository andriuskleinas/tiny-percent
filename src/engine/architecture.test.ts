import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const engineDir = fileURLToPath(new URL('.', import.meta.url))

/** Every module specifier the engine reaches for, across all its source files. */
function imports(dir: string): Array<{ file: string; specifier: string }> {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return imports(full)
    if (!/\.tsx?$/.test(name)) return []
    const source = readFileSync(full, 'utf8')
    return [...source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => ({
      file: relative(engineDir, full),
      specifier: m[1] as string,
    }))
  })
}

/** `../ui/x`, `./state/url`, `@/ui`, bare `react` — all forbidden inside the engine. */
function forbidden(specifier: string): boolean {
  if (/(^|\/)(ui|state)(\/|$)/.test(specifier)) return true
  return /^react(-dom)?(\/|$)/.test(specifier)
}

describe('engine boundary', () => {
  it('finds engine sources to check', () => {
    expect(imports(engineDir).length).toBeGreaterThan(0)
  })

  it('never imports from ui, state, or React', () => {
    const violations = imports(engineDir)
      .filter(({ specifier }) => forbidden(specifier))
      .map(({ file, specifier }) => `${file} imports "${specifier}"`)
    expect(violations).toEqual([])
  })

  it('recognises a violation when it sees one', () => {
    // Guards the guard: if this ever passes, the rule above has stopped working.
    expect(forbidden('../ui/Entry')).toBe(true)
    expect(forbidden('./state/url')).toBe(true)
    expect(forbidden('react')).toBe(true)
    expect(forbidden('node:fs')).toBe(false)
    expect(forbidden('./money')).toBe(false)
  })
})
