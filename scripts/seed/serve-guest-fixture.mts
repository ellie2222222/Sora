// Serves one guest-mode fixture (seed-demo.mts --guest-fixture) for a development build's "Load demo data",
// which fetches EXPO_PUBLIC_DEMO_FIXTURE_URL. An emulator reaches the host's loopback at 10.0.2.2; a phone
// on the LAN needs FIXTURE_HOST=0.0.0.0 and the machine's address in the URL.
//   node scripts/seed/serve-guest-fixture.mts demo-guest.json      → http://127.0.0.1:3420/

import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/seed/serve-guest-fixture.mts <fixture.json>');
  process.exit(2);
}
const body = readFileSync(file);
JSON.parse(body.toString('utf8'));
const host = process.env.FIXTURE_HOST ?? '127.0.0.1';
const port = Number(process.env.FIXTURE_PORT ?? 3420);

createServer((request, response) => {
  if (request.method !== 'GET') {
    response.writeHead(405).end();
    return;
  }
  response.writeHead(200, { 'content-type': 'application/json', 'content-length': body.length });
  response.end(body);
}).listen(port, host, () => console.log(`serving ${file} (${body.length} bytes) on http://${host}:${port}/`));
