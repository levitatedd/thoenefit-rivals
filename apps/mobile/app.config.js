// Dynamic Expo config: app.json holds the static settings; this adds the values that must have a
// single source of truth. See docs/DEVELOPMENT.md → "Versioning".
const pkg = require('./package.json');
const { parseVersion, resolveBuildNumber, resolveVariant } = require('./config/version');

module.exports = ({ config }) => {
  parseVersion(pkg.version); // fail fast on a malformed version
  const buildNumber = resolveBuildNumber(process.env);
  const variant = resolveVariant(process.env);

  return {
    ...config,
    version: pkg.version,
    ios: { ...config.ios, buildNumber: String(buildNumber) },
    android: { ...config.android, versionCode: buildNumber },
    extra: { ...config.extra, buildNumber, variant },
  };
};
