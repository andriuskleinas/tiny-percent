import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WORKED_EXAMPLE } from './presets'
import { deleteSaved, listSaved, loadSaved, saveScenario } from './storage'

/** A localStorage that behaves, and one that throws the way a private window does. */
function fakeStore() {
  let data: Record<string, string> = {}
  return {
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v
    },
    removeItem: (k: string) => {
      delete data[k]
    },
    clear: () => {
      data = {}
    },
  }
}

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: fakeStore() })
})

describe('saved scenarios', () => {
  it('saves and loads one back exactly', () => {
    expect(saveScenario('My deal', WORKED_EXAMPLE)).toBe(true)
    expect(loadSaved('My deal')).toEqual(WORKED_EXAMPLE)
  })

  it('lists what is saved, newest first', () => {
    saveScenario('First', WORKED_EXAMPLE)
    saveScenario('Second', { ...WORKED_EXAMPLE, currency: 'GBP' })
    expect(listSaved().map((s) => s.name)).toEqual(['Second', 'First'])
  })

  it('replaces rather than duplicating a name', () => {
    saveScenario('Deal', WORKED_EXAMPLE)
    saveScenario('Deal', { ...WORKED_EXAMPLE, currency: 'EUR' })
    expect(listSaved()).toHaveLength(1)
    expect(loadSaved('Deal')?.currency).toBe('EUR')
  })

  it('deletes one', () => {
    saveScenario('Deal', WORKED_EXAMPLE)
    deleteSaved('Deal')
    expect(loadSaved('Deal')).toBeUndefined()
  })

  it('refuses an empty name', () => {
    expect(saveScenario('   ', WORKED_EXAMPLE)).toBe(false)
  })
})

describe('a browser that refuses to store', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('The operation is insecure.')
        },
        setItem: () => {
          throw new Error('QuotaExceededError')
        },
      },
    })
  })

  it('reports no saved scenarios instead of throwing', () => {
    expect(listSaved()).toEqual([])
    expect(loadSaved('anything')).toBeUndefined()
  })

  it('says saving failed instead of throwing', () => {
    expect(saveScenario('Deal', WORKED_EXAMPLE)).toBe(false)
  })
})

describe('the store is editable by hand, so what comes out is validated', () => {
  it('drops entries that are not a scenario any more', () => {
    const store = fakeStore()
    store.setItem(
      'angel-dilution-calculator:saved',
      JSON.stringify([
        { name: 'Good', savedAt: '2026-01-01T00:00:00Z', scenario: WORKED_EXAMPLE },
        { name: 'Tampered', savedAt: '2026-01-02T00:00:00Z', scenario: { version: 99 } },
        { name: 'Nonsense', savedAt: '2026-01-03T00:00:00Z', scenario: 'not an object' },
      ]),
    )
    vi.stubGlobal('window', { localStorage: store })
    expect(listSaved().map((s) => s.name)).toEqual(['Good'])
  })

  it('survives the key holding something that is not JSON at all', () => {
    const store = fakeStore()
    store.setItem('angel-dilution-calculator:saved', 'not json {{{')
    vi.stubGlobal('window', { localStorage: store })
    expect(listSaved()).toEqual([])
  })
})
