/**
 * The session, and the single-flight refresh.
 *
 * Why single-flight: an app screen typically fires several queries at once, so an
 * expired access token produces N simultaneous 401s. Refreshing per 401 would
 * send N refresh requests with the same token — and the API rotates refresh
 * tokens single-use and revokes the whole family when one is replayed (API spec
 * §5.3). The second request would therefore not merely be wasteful, it would log
 * the user out of every device. One in-flight refresh, shared by every waiter, is
 * the only correct shape.
 *
 * Nothing here imports React Native or axios, so the latch is testable directly.
 */

import type { AuthTokens } from '@sora/contracts';

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds at which the access token stops being accepted. */
  expiresAt: number;
}

export interface SessionPersistence {
  load(): Promise<StoredSession | null>;
  save(session: StoredSession): Promise<void>;
  clear(): Promise<void>;
}

export type RefreshFn = (refreshToken: string) => Promise<AuthTokens>;

export interface SessionManagerOptions {
  persistence: SessionPersistence;
  refresh: RefreshFn;
  now?: () => number;
}

export type SessionListener = (session: StoredSession | null) => void;

/** Treat a token as expired slightly early, so it cannot lapse mid-flight. */
const EXPIRY_SKEW_MS = 30_000;

export class SessionManager {
  private session: StoredSession | null = null;
  private inflight: Promise<StoredSession | null> | null = null;
  private readonly listeners = new Set<SessionListener>();
  private readonly options: SessionManagerOptions;

  constructor(options: SessionManagerOptions) {
    this.options = options;
  }

  private now(): number {
    return (this.options.now ?? Date.now)();
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.session);
  }

  subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  current(): StoredSession | null {
    return this.session;
  }

  getAccessToken(): string | null {
    return this.session?.accessToken ?? null;
  }

  isAccessTokenFresh(): boolean {
    if (this.session === null) return false;
    return this.session.expiresAt - EXPIRY_SKEW_MS > this.now();
  }

  /** Read whatever the last run persisted, so a relaunch stays signed in. */
  async restore(): Promise<StoredSession | null> {
    const stored = await this.options.persistence.load();
    this.session = stored;
    this.emit();
    return stored;
  }

  async adopt(tokens: AuthTokens): Promise<StoredSession> {
    const session: StoredSession = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: this.now() + tokens.expiresIn * 1000,
    };
    this.session = session;
    await this.options.persistence.save(session);
    this.emit();
    return session;
  }

  async clear(): Promise<void> {
    this.session = null;
    await this.options.persistence.clear();
    this.emit();
  }

  /**
   * Refresh, joining any attempt already running.
   *
   * The latch is released once the attempt settles — success or failure — so a
   * later 401 can start a fresh attempt rather than being answered forever by a
   * stale rejected promise.
   */
  refreshTokens(): Promise<StoredSession | null> {
    const existing = this.inflight;
    if (existing !== null) return existing;

    // The latch is cleared inside the chain the caller awaits, not from a
    // side-chain hung off it. A side-chain clears one or two microtasks later,
    // so "the refresh I awaited has finished" would not imply "another refresh
    // can start" — the next caller would be handed an already-settled promise.
    const attempt: Promise<StoredSession | null> = this.performRefresh().finally(() => {
      if (this.inflight === attempt) this.inflight = null;
    });
    this.inflight = attempt;
    return attempt;
  }

  private async performRefresh(): Promise<StoredSession | null> {
    const current = this.session;
    if (current === null) return null;

    try {
      const tokens = await this.options.refresh(current.refreshToken);
      return await this.adopt(tokens);
    } catch {
      await this.clear();
      return null;
    }
  }
}
