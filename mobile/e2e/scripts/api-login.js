// Signs a user in through the API (Maestro runs this on the host) so the other scripts can read and
// write server data; Maestro JS has no imports, so this is how they share it. EMAIL and PASSWORD
// default to the seeded user.
const email = typeof EMAIL === 'undefined' ? E2E_EMAIL : EMAIL;
const password = typeof PASSWORD === 'undefined' ? E2E_PASSWORD : PASSWORD;
const response = http.post(E2E_API_BASE + '/auth/login', {
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: email, password: password }),
});
if (response.status !== 200) throw new Error('api-login: API answered ' + response.status + ' ' + response.body);
output.apiToken = json(response.body).data.tokens.accessToken;
