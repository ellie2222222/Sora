// A fresh user owning two wallets, so signing in with guest data must ask which wallet receives it.
// Same probe+e2e-<unique>@example.invalid shape as seed.mts, removable by exact email.
const unique = 'guest-' + Date.now();
const email = 'probe+e2e-' + unique + '@example.invalid';
const password = 'probe-pw-' + unique;
const jsonHeaders = { 'Content-Type': 'application/json' };

const registered = http.post(E2E_API_BASE + '/auth/register', {
  headers: jsonHeaders,
  body: JSON.stringify({ email: email, password: password, displayName: 'probe-e2e-guest', timeZone: 'Asia/Ho_Chi_Minh' }),
});
if (registered.status !== 201) throw new Error('register-two-wallet-user: register answered ' + registered.status + ' ' + registered.body);
const auth = Object.assign({ Authorization: 'Bearer ' + json(registered.body).data.tokens.accessToken }, jsonHeaders);

const second = http.post(E2E_API_BASE + '/wallets', { headers: auth, body: JSON.stringify({ name: 'E2E second wallet ' + unique, timeZone: 'Asia/Ho_Chi_Minh' }) });
if (second.status !== 201) throw new Error('register-two-wallet-user: wallet create answered ' + second.status + ' ' + second.body);

output.userEmail = email;
output.userPassword = password;
output.targetWalletId = json(second.body).data.id;
