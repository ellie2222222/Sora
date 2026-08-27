/**
 * Per-currency totals.
 *
 * Every total this API reports is an array keyed by currency, never a scalar. A
 * wallet holding a VND and a USD account has no single balance, and adding the
 * two numbers produces a figure that is silently meaningless — conversion is out
 * of scope for v1 (§16.4). Summation itself is `add` from @sora/contracts, so
 * the arithmetic stays on scaled bigints.
 */

import {
  ZERO,
  add,
  formatMoney,
  subtract,
  type CurrencyTotal,
  type Scaled,
} from '@sora/contracts';

export class CurrencyLedger {
  private readonly totals = new Map<string, Scaled>();

  addTo(currency: string, amount: Scaled): void {
    this.totals.set(currency, add(this.totals.get(currency) ?? ZERO, amount));
  }

  /** Ensures a currency appears even at zero, so an empty account still reports. */
  ensure(currency: string): void {
    if (!this.totals.has(currency)) this.totals.set(currency, ZERO);
  }

  get(currency: string): Scaled {
    return this.totals.get(currency) ?? ZERO;
  }

  currencies(): string[] {
    return [...this.totals.keys()].sort();
  }

  toArray(): CurrencyTotal[] {
    return this.currencies().map((currency) => ({
      currency,
      amount: formatMoney(this.get(currency)),
    }));
  }
}

/** Element-wise `left - right` across the union of both ledgers' currencies. */
export function netOf(income: CurrencyLedger, expense: CurrencyLedger): CurrencyTotal[] {
  const net = new CurrencyLedger();

  for (const currency of [...income.currencies(), ...expense.currencies()]) {
    net.ensure(currency);
  }
  for (const currency of net.currencies()) {
    net.addTo(currency, subtract(income.get(currency), expense.get(currency)));
  }

  return net.toArray();
}
