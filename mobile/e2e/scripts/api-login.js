// Signs the seeded user in through the API (Maestro runs this on the host) so the other scripts can
// read and write server data; Maestro JS has no imports, so this is how they share it.
const response = http.post(E2E_API_BASE + '/auth/login', {
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: E2E_EMAIL, password: E2E_PASSWORD }),
});
if (response.status !== 200) throw new Error('api-login: API answered ' + response.status + ' ' + response.body);
output.apiToken = json(response.body).data.tokens.accessToken;
