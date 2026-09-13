// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { FeeDrag } from './FeeDrag'

/**
 * Regression guard. Entry and management fees were drawn as a third segment of
 * the gross proceeds bar, but they are paid on the way in and are never part of
 * the proceeds. The segments therefore ran past the end of the bar they were
 * labelled as dividing.
 */

afterEach(cleanup)

const BAR_START = 40
const BAR_WIDTH = 380

function segments(container: HTMLElement) {
  return [...container.querySelectorAll('rect')].map((r) => ({
    x: Number(r.getAttribute('x')),
    w: Number(r.getAttribute('width')),
  }))
}

describe('the gross proceeds bar only divides the proceeds', () => {
  it('fills exactly the bar with net and carry, and nothing beyond it', () => {
    const { container } = render(
      <FeeDrag grossCents={192_000_00} netCents={163_600_00} carryCents={28_400_00} feesPaidCents={1_000_00} />,
    )
    const drawn = segments(container)
    expect(drawn).toHaveLength(2)
    const end = Math.max(...drawn.map((s) => s.x + s.w))
    expect(end).toBeCloseTo(BAR_START + BAR_WIDTH, 6)
  })

  it('stays inside the bar however large the fees are', () => {
    const { container } = render(
      <FeeDrag grossCents={1_920_000_00} netCents={1_588_000_00} carryCents={332_000_00} feesPaidCents={54_500_00} />,
    )
    const end = Math.max(...segments(container).map((s) => s.x + s.w))
    expect(end).toBeLessThanOrEqual(BAR_START + BAR_WIDTH + 1e-6)
  })

  it('states fees paid on the way in separately, rather than hiding them', () => {
    const { container } = render(
      <FeeDrag grossCents={192_000_00} netCents={163_600_00} carryCents={28_400_00} feesPaidCents={1_000_00} />,
    )
    expect(container.textContent).toMatch(/\$1,000 .*fees.*paid on the way in/i)
  })

  it('says nothing about fees when there were none', () => {
    const { container } = render(
      <FeeDrag grossCents={192_000_00} netCents={163_600_00} carryCents={28_400_00} feesPaidCents={0} />,
    )
    expect(container.textContent).not.toMatch(/on the way in/i)
  })

  it('draws a single net segment when no carry is due', () => {
    const { container } = render(
      <FeeDrag grossCents={37_500_00} netCents={37_500_00} carryCents={0} feesPaidCents={1_000_00} />,
    )
    const drawn = segments(container).filter((s) => s.w > 0)
    expect(drawn).toHaveLength(1)
    expect(drawn[0]?.w).toBeCloseTo(BAR_WIDTH, 6)
  })
})
