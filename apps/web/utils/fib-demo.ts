/**
 * The landing demo's evaluation, extracted so it can be tested.
 *
 * It used to be a string comparison against "1" and "2". That rejected
 * `fib(n-2) + fib(n-1)` — the same function with the terms swapped, and
 * correct — and then reported "received NaN", a number nothing had computed.
 * The first thing a visitor touches, on a product whose claim is that real
 * tests tell you the truth, was telling a plausible lie to someone who was
 * right.
 */

/**
 * Runs `fib(10)` with the two offsets the visitor typed.
 *
 * Returns null when the recursion does not finish. `fib(n - 0)` calls itself
 * with the same argument forever, and a blank is an input someone can type
 * anything into, so the budget is what makes running this in the page safe
 * rather than a nicety.
 */
export function evaluateFibDemo(a: number, b: number, budget = 100_000): number | null {
  let steps = 0

  function fib(n: number): number {
    if (++steps > budget) throw new Error('diverged')
    if (n <= 1) return n
    return fib(n - a) + fib(n - b)
  }

  try {
    return fib(10)
  } catch {
    return null
  }
}

/** What `fib(10)` has to be. */
export const FIB_DEMO_EXPECTED = 55
