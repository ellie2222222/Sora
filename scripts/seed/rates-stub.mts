// A local stand-in for the exchange-rate provider (plan §10 phase 8), answering GET /<BASE> in the shape
// exchange-rate.service.ts reads, with fixed rates. POST /_control/down makes it fail like an outage,
// POST /_control/up restores it. Usage: RATES_STUB_PORT=3418 node scripts/seed/rates-stub.mts

import { createServer } from 'node:http';

import { VND_PER_UNIT } from './rates.ts';

const port = Number(process.env.RATES_STUB_PORT ?? 3418);
let down = false;

const server = createServer((request, response) => {
  const path = (request.url ?? '/').split('?')[0]!;
  const send = (status: number, body: unknown) => {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
  };
  if (request.method === 'POST' && (path === '/_control/down' || path === '/_control/up')) {
    down = path.endsWith('down');
    return send(200, { down });
  }
  if (request.method !== 'GET') return send(405, { result: 'error' });
  if (down) return send(503, { result: 'error', 'error-type': 'stubbed-outage' });
  const base = path.slice(1).toUpperCase();
  const basePerUnit = VND_PER_UNIT[base];
  if (basePerUnit === undefined) return send(404, { result: 'error', 'error-type': 'unsupported-code' });
  // rates[C] = units of C per one unit of the base, as the provider reports them.
  const rates = Object.fromEntries(Object.entries(VND_PER_UNIT).map(([currency, perUnit]) => [currency, basePerUnit / perUnit]));
  send(200, { result: 'success', base_code: base, time_last_update_utc: new Date().toUTCString(), rates });
});

server.listen(port, '127.0.0.1', () => console.log(`rates stub on http://127.0.0.1:${port} (POST /_control/down, /_control/up)`));
