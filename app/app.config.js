// Static settings live in app.json; this file only adds what depends on the build environment.
const { existsSync } = require('node:fs');

module.exports = ({ config }) => {
  const googleServicesFile = process.env.GOOGLE_SERVICES_FILE ?? './google-services.json';
  const versionCode = Number(process.env.ANDROID_VERSION_CODE) || undefined;

  return {
    ...config,
    android: {
      ...config.android,
      // Firebase Cloud Messaging: required for push notifications on Android.
      ...(existsSync(googleServicesFile) ? { googleServicesFile } : {}),
      ...(versionCode ? { versionCode } : {}),
    },
    extra: {
      ...config.extra,
      // Expo push tokens are scoped to the EAS project (`npx eas-cli init`).
      ...(process.env.EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID } } : {}),
    },
    plugins: [...(config.plugins ?? []), './plugins/withReleaseSigning'],
  };
};
