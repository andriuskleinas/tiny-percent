import type { Scenario } from '../engine/types'
import { isScenario } from './url'

/**
 * Saved scenarios live in this browser only. localStorage throws rather than
 * returning empty in a private window, with site data blocked, or over quota, so
 * every access is wrapped. A browser that refuses to store simply has no saved
 * scenarios, which is a fine outcome and never an error the user has to see.
 *
 * What comes back out is validated the same way a shared link is: the store is
 * editable by hand and by any other script on this origin.
 */

const KEY = 'angel-dilution-calculator:saved'
const LIMIT = 40

export interface SavedScenario {
  name: string
  savedAt: string
  scenario: Scenario
}

function readAll(): SavedScenario[] {
  let raw: string | null
  try {
    raw = window.localStorage.getItem(KEY)
  } catch {
    return []
  }
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw, (key, value) => (key === '__proto__' ? undefined : value))
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is SavedScenario =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as SavedScenario).name === 'string' &&
        typeof (entry as SavedScenario).savedAt === 'string' &&
        isScenario((entry as SavedScenario).scenario),
    )
  } catch {
    return []
  }
}

function writeAll(entries: SavedScenario[]): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries.slice(0, LIMIT)))
    return true
  } catch {
    return false
  }
}

export function listSaved(): SavedScenario[] {
  return readAll().sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

/** Saving under an existing name replaces it. Returns false if the browser refused. */
export function saveScenario(name: string, scenario: Scenario): boolean {
  const trimmed = name.trim().slice(0, 80)
  if (!trimmed) return false
  const rest = readAll().filter((entry) => entry.name !== trimmed)
  return writeAll([{ name: trimmed, savedAt: new Date().toISOString(), scenario }, ...rest])
}

export function loadSaved(name: string): Scenario | undefined {
  return readAll().find((entry) => entry.name === name)?.scenario
}

export function deleteSaved(name: string): boolean {
  return writeAll(readAll().filter((entry) => entry.name !== name))
}
