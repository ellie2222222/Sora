// How many of the wallet's transactions carry DESCRIPTION, so a flow can prove a write landed exactly
// once. Run api-login.js first. WALLET_ID defaults to the seeded user's wallet.
const auth = { Authorization: 'Bearer ' + output.apiToken };
const walletId = typeof WALLET_ID === 'undefined' ? E2E_WALLET_ID : WALLET_ID;

const page = json(http.get(E2E_API_BASE + '/transactions?walletId=' + walletId + '&pageSize=200', { headers: auth }).body);
output.matches = page.data.filter((transaction) => transaction.description === DESCRIPTION).length;
