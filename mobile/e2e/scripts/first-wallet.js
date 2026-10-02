// The signed-in user's own wallet, for a user registered in the app (registration creates exactly one).
// Run api-login.js first.
const wallets = json(http.get(E2E_API_BASE + '/wallets', { headers: { Authorization: 'Bearer ' + output.apiToken } }).body).data;
const own = wallets.filter((wallet) => wallet.isOwn);
if (own.length !== 1) throw new Error('first-wallet: expected one own wallet, found ' + own.length);
output.walletId = own[0].id;
