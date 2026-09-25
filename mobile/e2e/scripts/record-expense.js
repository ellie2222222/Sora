// A change the app did not make itself, so a flow can prove the app fetches it. Run api-login.js first.
const auth = { Authorization: 'Bearer ' + output.apiToken };

const account = json(http.get(E2E_API_BASE + '/accounts?walletId=' + E2E_WALLET_ID, { headers: auth }).body).data[0];
const category = json(http.get(E2E_API_BASE + '/categories?walletId=' + E2E_WALLET_ID + '&type=EXPENSE&pageSize=200', { headers: auth }).body)
  .data.find((candidate) => candidate.type === 'EXPENSE');

const created = http.post(E2E_API_BASE + '/transactions', {
  headers: Object.assign({ 'Content-Type': 'application/json' }, auth),
  body: JSON.stringify({
    type: 'EXPENSE',
    fromAccountId: account.id,
    categoryId: category.id,
    amount: '12000',
    currency: account.currency,
    transactionDate: new Date().toISOString(),
    description: DESCRIPTION,
  }),
});
if (created.status !== 201) throw new Error('record-expense: API answered ' + created.status + ' ' + created.body);
