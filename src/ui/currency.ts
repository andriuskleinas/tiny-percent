import { createContext, useContext, useMemo } from 'react'
import type { Currency } from '../engine/types'
import { compactMoney, money, symbolFor } from './format'

/**
 * The scenario's currency, available to every figure on the page. Formatting
 * used to default to dollars everywhere, so a euro deal was shown in dollars.
 * Anything that prints money reads it from here instead.
 */
export const CurrencyContext = createContext<Currency>('USD')

export function useMoney() {
  const currency = useContext(CurrencyContext)
  return useMemo(
    () => ({
      currency,
      symbol: symbolFor(currency),
      money: (cents: number) => money(cents, currency),
      compactMoney: (cents: number) => compactMoney(cents, currency),
    }),
    [currency],
  )
}
