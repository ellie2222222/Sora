// The server, not the screen, proves a UI write happened as entered. Run api-login.js first.
const auth = { Authorization: 'Bearer ' + output.apiToken };

const page = json(http.get(E2E_API_BASE + '/transactions?walletId=' + E2E_WALLET_ID + '&pageSize=200', { headers: auth }).body);
const match = page.data.find((transaction) => transaction.description === DESCRIPTION);
if (!match) throw new Error('find-transaction: no transaction described "' + DESCRIPTION + '"');

output.day = match.transactionDate.slice(0, 10);
output.amount = match.amount;
