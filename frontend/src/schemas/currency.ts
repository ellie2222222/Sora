import { z } from 'zod'

/**
 * Supported currencies (SRS BR-07). Mirrors the backend `Currency` enum — keep in
 * sync (FE-02). Nothing outside this pair is accepted anywhere in the system.
 */
export const CURRENCIES = ['VND', 'USD'] as const

export type Currency = (typeof CURRENCIES)[number]

export const currencySchema = z.enum(CURRENCIES, {
  errorMap: () => ({ message: 'Currency must be VND or USD' }),
})

// No exchange-rate schema lives here on purpose: a rate is never part of a form.
// The backend fetches the rate when money is recorded and snapshots it on the row
// (BR-07a); the UI only ever reads a rate back, via GET /api/v1/exchange-rates.
