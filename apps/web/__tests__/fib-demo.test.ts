import { describe, expect, it } from 'vitest'
import { evaluateFibDemo, FIB_DEMO_EXPECTED } from '../utils/fib-demo'

describe('the landing demo', () => {
  it('passes the pair the hint suggests', () => {
    expect(evaluateFibDemo(1, 2)).toBe(FIB_DEMO_EXPECTED)
  })

  it('passes the same pair with the terms swapped', () => {
    // The bug this file exists for. `fib(n-2) + fib(n-1)` is the same function
    // written the other way round, and the demo used to mark it wrong — then
    // report "received NaN", a number nothing had computed.
    expect(evaluateFibDemo(2, 1)).toBe(FIB_DEMO_EXPECTED)
  })

  it('fails a pair that terminates and is wrong, with the number it produced', () => {
    // Not NaN. 512 is what that code really returns, and a failure message that
    // says so is the difference between this product and a mockup of it.
    expect(evaluateFibDemo(1, 1)).toBe(512)
  })

  it('reports a non-terminating pair as null rather than hanging the page', () => {
    // `fib(n - 0)` calls itself with the same argument forever. A blank is an
    // input a person can type anything into, so this is the case that decides
    // whether running the demo in the browser is safe at all.
    expect(evaluateFibDemo(0, 1)).toBeNull()
  })

  it('treats both offsets as zero the same way', () => {
    expect(evaluateFibDemo(0, 0)).toBeNull()
  })

  it('fails an ordinary wrong pair', () => {
    expect(evaluateFibDemo(3, 2)).toBe(1)
  })

  it('handles negative offsets without hanging', () => {
    // `fib(n + 1)` grows away from the base case forever.
    expect(evaluateFibDemo(-1, 2)).toBeNull()
  })

  it('respects a smaller budget, so the guard is the budget and not luck', () => {
    expect(evaluateFibDemo(1, 2, 5)).toBeNull()
  })
})
