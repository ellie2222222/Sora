// Takes the API down (STATE=down) or brings it back (STATE=up) behind outage-switch.mts, which the app
// talks to in place of the API. E2E_OUTAGE_SWITCH is its host-side address, e.g. http://127.0.0.1:3418.
const response = http.post(E2E_OUTAGE_SWITCH + '/__outage/' + STATE, { body: '' });
if (response.status !== 204) throw new Error('outage: switch answered ' + response.status);
