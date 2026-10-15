// Expo applies this on top of app.json: every build opts out of GWP-ASan, and an E2E build
// (SORA_E2E_BUILD=1) also allows plain HTTP to its local test API, which a release build refuses.
const { withAndroidManifest } = require('expo/config-plugins');

function withApplicationAttribute(config, name, value) {
  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (application) application.$[name] = value;
    return mod;
  });
}

// Android 14+ samples ~1% of launches with GWP-ASan, whose stack walk crashed inside Hermes
// (SIGSEGV in android_unsafe_frame_pointer_chase); nothing here collects its reports anyway.
const withGwpAsanDisabled = (config) => withApplicationAttribute(config, 'android:gwpAsanMode', 'never');
const withE2ECleartext = (config) => withApplicationAttribute(config, 'android:usesCleartextTraffic', 'true');

module.exports = ({ config }) => {
  const shipped = withGwpAsanDisabled(config);
  const allowCleartext =
    process.env.SORA_E2E_BUILD === '1' || process.env.EXPO_PUBLIC_ALLOW_INSECURE_API === 'true';
  return allowCleartext ? withE2ECleartext(shipped) : shipped;
};
