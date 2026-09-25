// Expo applies this on top of app.json. Only an E2E build (SORA_E2E_BUILD=1) changes anything: it
// talks to a local test API over plain HTTP, which Android refuses in a release build by default.
const { withAndroidManifest } = require('expo/config-plugins');

function withE2ECleartext(config) {
  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (application) application.$['android:usesCleartextTraffic'] = 'true';
    return mod;
  });
}

module.exports = ({ config }) => (process.env.SORA_E2E_BUILD === '1' ? withE2ECleartext(config) : config);
