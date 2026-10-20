// Signs release builds with the upload key when ANDROID_KEYSTORE_PATH is set (CI release workflow);
// otherwise release builds keep Expo's default debug signing, which is fine for local testing.
const { withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_SIGNING_CONFIG = `
        release {
            if (System.getenv('ANDROID_KEYSTORE_PATH')) {
                storeFile file(System.getenv('ANDROID_KEYSTORE_PATH'))
                storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
                keyAlias System.getenv('ANDROID_KEY_ALIAS')
                keyPassword System.getenv('ANDROID_KEY_PASSWORD')
            }
        }`;

const RELEASE_BUILD_TYPE = /(release \{\s*(?:\/\/[^\n]*\n\s*)*)signingConfig signingConfigs\.debug/;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    let gradle = mod.modResults.contents;
    if (gradle.includes("System.getenv('ANDROID_KEYSTORE_PATH')")) return mod;

    if (!gradle.includes('signingConfigs {') || !RELEASE_BUILD_TYPE.test(gradle)) {
      throw new Error('withReleaseSigning: unexpected android/app/build.gradle layout');
    }
    gradle = gradle.replace('signingConfigs {', `signingConfigs {${RELEASE_SIGNING_CONFIG}`);
    gradle = gradle.replace(
      RELEASE_BUILD_TYPE,
      "$1signingConfig System.getenv('ANDROID_KEYSTORE_PATH') ? signingConfigs.release : signingConfigs.debug",
    );
    mod.modResults.contents = gradle;
    return mod;
  });
};
