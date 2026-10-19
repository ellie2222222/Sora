// Stands between the app and the API like a tunnel or gateway does, so a flow can take the API "down"
// with the device still online: down, every request gets the 502 HTML page a gateway serves when its
// upstream is gone. Airplane mode cannot show this case, since NetInfo reports it and a server outage never is.
// Usage: E2E_API_URL=http://127.0.0.1:3417 node mobile/e2e/outage-switch.mts 3418
// Flows flip it with POST /__outage/down and /__outage/up (scripts/outage.js).

import { createServer, request } from 'node:http';

const upstream = process.env.E2E_API_URL;
const port = Number(process.argv[2] ?? 3418);
if (!upstream) {
  console.error('E2E_API_URL is required.');
  process.exit(2);
}
const target = new URL(upstream);
let down = false;

createServer((req, res) => {
  if (req.url === '/__outage/down' || req.url === '/__outage/up') {
    down = req.url.endsWith('/down');
    console.log(`outage switch: API ${down ? 'down' : 'up'}`);
    res.writeHead(204).end();
    return;
  }
  if (down) {
    res.writeHead(502, { 'content-type': 'text/html' }).end('<html><body><h1>502 Bad Gateway</h1></body></html>');
    return;
  }
  const forward = request(
    { host: target.hostname, port: target.port, path: req.url, method: req.method, headers: { ...req.headers, host: target.host } },
    (answer) => {
      res.writeHead(answer.statusCode ?? 502, answer.headers);
      answer.pipe(res);
    },
  );
  forward.on('error', () => res.writeHead(502, { 'content-type': 'text/html' }).end('<html>502</html>'));
  req.pipe(forward);
}).listen(port, '127.0.0.1', () => console.log(`outage switch: :${port} -> ${upstream}`));
