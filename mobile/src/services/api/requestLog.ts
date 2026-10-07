import type { InternalAxiosRequestConfig } from 'axios';

// Passwords and tokens never reach a log, even a dev one (LA-01).
const SECRET_KEY = /password|token|secret/i;

export function redactForLog(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactForLog);
  if (value === null || typeof value !== 'object') return value;
  if (Object.getPrototypeOf(value) !== Object.prototype) return `[${value.constructor.name}]`;
  return Object.fromEntries(
    Object.entries(value).map(([key, field]) => [key, SECRET_KEY.test(key) ? '[redacted]' : redactForLog(field)]),
  );
}

/** "POST http://host:3000/api/v1/wallets params={…} body={…}", for the dev console. */
export function describeRequest(
  config: Pick<InternalAxiosRequestConfig, 'method' | 'baseURL' | 'url' | 'params' | 'data'>,
): string {
  const parts = [`[api] ${(config.method ?? 'get').toUpperCase()} ${config.baseURL ?? ''}${config.url ?? ''}`];
  if (config.params !== undefined) parts.push(`params=${JSON.stringify(redactForLog(config.params))}`);
  if (config.data !== undefined) parts.push(`body=${JSON.stringify(redactForLog(config.data))}`);
  return parts.join(' ');
}

type LoggedConfig = Pick<InternalAxiosRequestConfig, 'method' | 'baseURL' | 'url'>;

/** "← 201 POST /wallets". */
export function describeResponse(config: LoggedConfig | undefined, status: number): string {
  return `[api] ← ${status} ${(config?.method ?? 'get').toUpperCase()} ${config?.url ?? ''}`;
}

export interface FailedRequest {
  config?: LoggedConfig;
  response?: { status: number; data?: unknown };
  code?: string;
  message?: string;
}

/**
 * "← 409 POST /wallets: <server message>", or, when nothing came back, the full URL tried and
 * axios's reason, since a wrong base URL is the usual cause of a dev network error.
 */
export function describeFailure({ config, response, code, message }: FailedRequest): string {
  const method = (config?.method ?? 'get').toUpperCase();
  if (response) {
    const serverMessage = (response.data as { message?: unknown } | undefined)?.message;
    const suffix = typeof serverMessage === 'string' ? `: ${serverMessage}` : '';
    return `[api] ← ${response.status} ${method} ${config?.url ?? ''}${suffix}`;
  }
  const reason = [code, message].filter(Boolean).join(': ');
  return `[api] ← network error ${method} ${config?.baseURL ?? ''}${config?.url ?? ''}${reason ? ` (${reason})` : ''}`;
}
