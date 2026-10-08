import { storyDates } from '../calendar.ts';
import { LedgerBuilder, settle, type Ledger } from '../ledger.ts';
import { WALLETS, walletOfAccount } from '../personas.ts';
import { createRng } from '../rng.ts';
import { generatorContext } from './context.ts';
import { corrections } from './corrections.ts';
import { events, goalFunding } from './events.ts';
import { habits } from './habits.ts';
import { recurring } from './recurring.ts';

/** The whole ledger for one SEED and anchor, with no API call. Same inputs, same ledger. */
export function buildLedger(seed: number, anchor: string): { ledger: Ledger; dates: ReturnType<typeof storyDates> } {
  const dates = storyDates(anchor);
  const builder = new LedgerBuilder();
  const ctx = generatorContext(builder, createRng(seed), dates);
  recurring(ctx);
  habits(ctx);
  events(ctx);
  goalFunding(ctx);
  corrections(ctx);
  const ledger = settle(builder, (account) => WALLETS[walletOfAccount(account).key].owner);
  return { ledger, dates };
}
