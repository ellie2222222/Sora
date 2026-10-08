// Phases 1–6 of the plan (§10): personas and memberships, wallets' accounts/categories/goals, the ledger's
// transactions, contributions and budgets, then corrections and the §1.4 state changes, in that order.

import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  formatMoney,
  type AccountResponse,
  type AuthResponse,
  type BudgetResponse,
  type CategoryResponse,
  type ContributionResponse,
  type GoalResponse,
  type TransactionResponse,
  type WalletInvitationCreatedResponse,
  type WalletMemberResponse,
  type WalletResponse,
} from '@sora/contracts';

import type { SeedApi, Session } from './client.ts';
import type { StoryDates } from './calendar.ts';
import { budgetSchedule, readBudget } from './figures.ts';
import { categorisedAccount, walletOfRow, zoneOfRow, type Contribution, type Ledger, type Row } from './ledger.ts';
import { instantOf } from './calendar.ts';
import {
  ACCOUNTS,
  BUDGETS,
  CUSTOM_CATEGORIES,
  GOALS,
  MEMBERSHIPS,
  PERSONAS,
  PERSONA_KEYS,
  STARTER_WALLETS,
  WALLETS,
  type AccountKey,
  type GoalKey,
  type PersonaKey,
  type WalletKey,
} from './personas.ts';

export interface SeedIds {
  runId: string;
  seed: number;
  anchor: string;
  users: Partial<Record<PersonaKey, { id: string; email: string }>>;
  wallets: Partial<Record<WalletKey, string>>;
  accounts: Partial<Record<AccountKey, string>>;
  categories: Partial<Record<WalletKey, Record<string, string>>>;
  goals: Partial<Record<GoalKey, string>>;
  budgets: Record<string, string>;
  /** Ledger row id → server transaction id. */
  transactions: Record<string, string>;
  /** Ledger contribution id → server contribution id. */
  contributions: Record<string, string>;
  sisterInvitation?: { id: string; email: string; token: string };
  ai?: { conversationId: string; confirmed: string; dismissed: string; pending: string; transactionId: string };
}

/** The app's category icon keys, read from its own map so the seed can't drift from it (plan §4). */
function appIconKeys(): Set<string> {
  const source = readFileSync(new URL('../../mobile/src/utils/categoryIcons.ts', import.meta.url), 'utf8');
  const block = source.slice(source.indexOf('const CATEGORY_ICONS'), source.indexOf('};', source.indexOf('const CATEGORY_ICONS')));
  return new Set([...block.matchAll(/^\s*'?([a-z0-9-]+)'?:/gm)].map((match) => match[1]!));
}

const inParallel = async <T>(groups: Map<PersonaKey, T[]>, post: (persona: PersonaKey, item: T) => Promise<void>) =>
  Promise.all([...groups].map(async ([persona, items]) => {
    for (const item of items) await post(persona, item);
  }));

function byPersona<T extends { by: PersonaKey }>(items: readonly T[]): Map<PersonaKey, T[]> {
  const groups = new Map<PersonaKey, T[]>();
  for (const item of items) groups.set(item.by, [...(groups.get(item.by) ?? []), item]);
  return groups;
}

export class Seeder {
  readonly sessions = {} as Record<PersonaKey, Session>;
  readonly ids: SeedIds;
  private readonly api: SeedApi;
  private readonly ledger: Ledger;
  private readonly dates: StoryDates;

  constructor(api: SeedApi, ledger: Ledger, dates: StoryDates, runId: string, seed: number) {
    this.api = api;
    this.ledger = ledger;
    this.dates = dates;
    this.ids = { runId, seed, anchor: dates.anchor, users: {}, wallets: {}, accounts: {}, categories: {}, goals: {}, budgets: {}, transactions: {}, contributions: {} };
  }

  session(persona: PersonaKey): Session {
    return this.sessions[persona];
  }

  ownerOf(wallet: WalletKey): Session {
    return this.sessions[WALLETS[wallet].owner];
  }

  categoryId(wallet: WalletKey, key: string): string {
    const id = this.ids.categories[wallet]?.[key];
    if (!id) throw new Error(`No category "${key}" in wallet ${wallet}`);
    return id;
  }

  // ---- Phase 1: personas, wallets, memberships
  async registerPersonas(): Promise<void> {
    for (const key of PERSONA_KEYS) {
      const persona = PERSONAS[key];
      const email = `seed+${key}-${this.ids.runId}@example.invalid`;
      const password = randomBytes(18).toString('base64url');
      const auth = await this.api.call<AuthResponse>('POST', '/auth/register', {
        body: { email, password, displayName: persona.displayName, baseCurrency: persona.baseCurrency, locale: persona.locale, timeZone: persona.timeZone },
        expect: [201],
      });
      this.sessions[key] = { persona: key, userId: auth.user.id, email, password, locale: persona.locale, accessToken: auth.tokens.accessToken, refreshToken: auth.tokens.refreshToken };
      this.ids.users[key] = { id: auth.user.id, email };
      const wallets = await this.api.call<WalletResponse[]>('GET', '/wallets', { session: this.sessions[key] });
      this.ids.wallets[key] = wallets.find((wallet) => wallet.isOwn)!.id;
    }
    for (const key of ['mom', 'house'] as const) {
      const wallet = await this.api.call<WalletResponse>('POST', '/wallets', { session: this.ownerOf(key), body: { name: WALLETS[key].name, timeZone: WALLETS[key].timeZone }, expect: [201] });
      this.ids.wallets[key] = wallet.id;
    }
    for (const membership of MEMBERSHIPS) {
      const email = membership.invitee === 'sister' ? `seed+sister-${this.ids.runId}@example.invalid` : this.sessions[membership.invitee].email;
      const invitation = await this.api.call<WalletInvitationCreatedResponse>('POST', `/wallets/${this.ids.wallets[membership.wallet]}/invitations`, {
        session: this.ownerOf(membership.wallet),
        body: { email, role: membership.role, relationLabel: membership.relationLabel },
        expect: [201],
      });
      if (membership.invitee === 'sister') {
        this.ids.sisterInvitation = { id: invitation.id, email, token: invitation.token };
        continue;
      }
      await this.api.call('POST', '/invitations/accept', { session: this.sessions[membership.invitee], body: { token: invitation.token }, expect: [200, 201] });
    }
    await this.api.call<AuthResponse>('POST', '/auth/login', { body: { email: this.sessions.an.email, password: this.sessions.an.password }, expect: [200] });
  }

  // ---- Phase 2: accounts, custom categories, goals (ACTIVE, no contributions yet)
  async setUpWallets(): Promise<void> {
    for (const wallet of STARTER_WALLETS) {
      const owner = this.ownerOf(wallet);
      const categories = await this.api.all<CategoryResponse>(`/categories?walletId=${this.ids.wallets[wallet]}`, owner);
      this.ids.categories[wallet] = Object.fromEntries(categories.filter((category) => category.systemKey).map((category) => [category.systemKey!, category.id]));
      const accounts = await this.api.all<AccountResponse>(`/accounts?walletId=${this.ids.wallets[wallet]}`, owner);
      const starterCash = Object.values(ACCOUNTS).find((account) => account.wallet === wallet && account.name === null)!;
      this.ids.accounts[starterCash.key] = accounts.find((account) => account.type === 'CASH')!.id;
    }
    for (const account of Object.values(ACCOUNTS)) {
      if (account.name === null) continue;
      const created = await this.api.call<AccountResponse>('POST', '/accounts', {
        session: this.ownerOf(account.wallet),
        body: { walletId: this.ids.wallets[account.wallet], name: account.name, type: account.type, currency: account.currency, initialBalance: account.opening },
        expect: [201],
      });
      this.ids.accounts[account.key] = created.id;
    }
    const icons = appIconKeys();
    for (const category of CUSTOM_CATEGORIES) {
      if (!icons.has(category.icon)) throw new Error(`Icon "${category.icon}" (${category.wallet}/${category.key}) isn't one the app knows`);
      const parentId = category.parent === null ? null : this.categoryId(category.wallet, category.parent);
      const created = await this.api.call<CategoryResponse>('POST', '/categories', {
        session: this.ownerOf(category.wallet),
        body: { walletId: this.ids.wallets[category.wallet], parentId, name: category.name, type: category.type, icon: category.icon },
        expect: [201],
      });
      (this.ids.categories[category.wallet] ??= {})[category.key] = created.id;
    }
    for (const goal of GOALS) {
      const created = await this.api.call<GoalResponse>('POST', '/goals', {
        session: this.ownerOf(goal.wallet),
        body: { walletId: this.ids.wallets[goal.wallet], name: goal.name, targetAmount: goal.target, currency: goal.currency, targetDate: goal.targetDate(this.dates) },
        expect: [201],
      });
      this.ids.goals[goal.key] = created.id;
    }
  }

  /** A create body as the row was first entered: a mistake's values where it has them. */
  transactionBody(row: Row): Record<string, unknown> {
    const mistake = row.mistake;
    const type = mistake?.type ?? row.type;
    const to = mistake && 'to' in mistake ? mistake.to! : row.to;
    const shape = { ...row, type, to };
    const category = mistake?.category ?? row.category;
    const day = mistake?.day ?? row.day;
    return {
      type,
      amount: formatMoney(mistake?.amount ?? row.amount),
      currency: ACCOUNTS[categorisedAccount(shape)].currency,
      transactionDate: instantOf(day, row.time, zoneOfRow(shape)),
      status: mistake?.kind === 'duplicate' ? 'COMPLETED' : row.status,
      description: row.description,
      reference: row.reference,
      categoryId: category === null ? null : this.categoryId(walletOfRow(shape), category),
      ...(type !== 'INCOME' ? { fromAccountId: this.ids.accounts[row.from!] } : {}),
      ...(type !== 'EXPENSE' ? { toAccountId: this.ids.accounts[to!] } : {}),
      ...(type === 'EXPENSE' && row.goal ? { goalId: this.ids.goals[row.goal] } : {}),
    };
  }

  // ---- Phases 3–4: every ledger row except the contribution-backed ones, each persona in ledger order
  async postTransactions(): Promise<number> {
    const rows = this.ledger.rows.filter((row) => !row.contribution);
    await inParallel(byPersona(rows), async (persona, row) => {
      const created = await this.api.call<TransactionResponse>('POST', '/transactions', { session: this.session(persona), body: this.transactionBody(row), expect: [201] });
      this.ids.transactions[row.id] = created.id;
    });
    return rows.length;
  }

  // ---- Phase 5: contributions (earmarks and transaction-backed), the Motorbike removal, budgets
  async postContributions(): Promise<void> {
    const rowsById = new Map(this.ledger.rows.map((row) => [row.id, row]));
    const ordered = [...this.ledger.contributions].sort((a, b) => (a.instant < b.instant ? -1 : a.instant > b.instant ? 1 : 0));
    await inParallel(byPersona(ordered), async (persona, entry: Contribution) => {
      const row = entry.row ? rowsById.get(entry.row)! : undefined;
      const created = await this.api.call<ContributionResponse>('POST', `/goals/${this.ids.goals[entry.goal]}/contributions`, {
        session: this.session(persona),
        body: {
          accountId: this.ids.accounts[entry.account],
          amount: formatMoney(entry.amount),
          currency: ACCOUNTS[entry.account].currency,
          contributionDate: entry.instant,
          note: row?.description ?? null,
          recordAsTransaction: row !== undefined,
          ...(row ? { categoryId: this.categoryId(walletOfRow(row), row.category!) } : {}),
        },
        expect: [201],
      });
      this.ids.contributions[entry.id] = created.id;
      if (row) this.ids.transactions[row.id] = created.transactionId!;
    });
    for (const entry of this.ledger.contributions.filter((contribution) => contribution.removed)) {
      await this.api.call('DELETE', `/goals/${this.ids.goals[entry.goal]}/contributions/${this.ids.contributions[entry.id]}`, { session: this.session(entry.by), expect: [200, 204] });
    }
  }

  async postBudgets(): Promise<void> {
    for (const budget of BUDGETS) {
      const schedule = budgetSchedule(budget, this.dates);
      const created = await this.api.call<BudgetResponse>('POST', '/budgets', {
        session: this.ownerOf(budget.wallet),
        body: {
          walletId: this.ids.wallets[budget.wallet],
          categoryId: budget.category ? this.categoryId(budget.wallet, budget.category) : null,
          goalId: budget.goal ? this.ids.goals[budget.goal] : null,
          name: budget.name,
          amount: budget.amount,
          currency: budget.currency,
          periodType: budget.periodType,
          startDate: schedule.startDate,
          endDate: schedule.endDate,
        },
        expect: [201],
      });
      this.ids.budgets[budget.key] = created.id;
      // §12.2: spent is computed on create, not zero. Only a fixed window reads the same on any day.
      if (budget.periodType === 'CUSTOM' || budget.periodType === 'GOAL') {
        const expected = readBudget(this.ledger, budget, this.dates, schedule.startDate).spent;
        if (created.spent !== formatMoney(expected)) throw new Error(`${budget.name} reads ${created.spent} on create, the ledger says ${formatMoney(expected)}`);
      }
    }
  }

  // ---- Phase 6: the corrections pass, then the state changes of §1.4
  async applyCorrections(): Promise<number> {
    const mistaken = this.ledger.rows.filter((row) => row.mistake);
    await inParallel(byPersona(mistaken), async (persona, row) => {
      const id = this.ids.transactions[row.id];
      const session = this.session(persona);
      switch (row.mistake!.kind) {
        case 'duplicate':
          await this.api.call('POST', `/transactions/${id}/delete`, { session, body: { reason: 'Entered twice' }, expect: [200, 204] });
          return;
        case 'amount':
          await this.api.call('PATCH', `/transactions/${id}`, { session, body: { amount: formatMoney(row.amount) } });
          return;
        case 'type':
          await this.api.call('PATCH', `/transactions/${id}`, { session, body: { type: 'TRANSFER', toAccountId: this.ids.accounts[row.to!], categoryId: this.categoryId(walletOfRow(row), row.category!) } });
          return;
        case 'category':
          await this.api.call('PATCH', `/transactions/${id}`, { session, body: { categoryId: this.categoryId(walletOfRow(row), row.category!) } });
          return;
        case 'date':
          await this.api.call('PATCH', `/transactions/${id}`, { session, body: { transactionDate: row.instant } });
      }
    });
    return mistaken.length;
  }

  async applyStateChanges(): Promise<void> {
    const an = this.sessions.an;
    await this.api.call('PATCH', `/goals/${this.ids.goals.motorbike}`, { session: an, body: { status: 'COMPLETED' } });
    await this.api.call('DELETE', `/goals/${this.ids.goals.guitar}`, { session: an, expect: [200, 204] });
    await this.api.call('DELETE', `/accounts/${this.ids.accounts.acb}`, { session: an, expect: [200, 204] });
    await this.api.call('DELETE', `/categories/${this.categoryId('an', 'gym')}`, { session: an, expect: [200, 204] });
    const members = await this.api.call<WalletMemberResponse[]>('GET', `/wallets/${this.ids.wallets.house}/members`, { session: an });
    const khoa = members.find((member) => member.userId === this.sessions.khoa.userId)!;
    await this.api.call('DELETE', `/wallets/${this.ids.wallets.house}/members/${khoa.id}`, { session: an, expect: [200, 204] });
    await this.api.call('DELETE', `/wallets/${this.ids.wallets.house}`, { session: an, expect: [200, 204] });
  }
}
