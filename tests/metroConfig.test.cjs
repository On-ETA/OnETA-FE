const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const config = require("../metro.config");

const root = path.resolve(__dirname, "..").replaceAll("\\", "/");
const excluded = (relativePath, separator = "/") => config.resolver.blockList.some(pattern =>
  pattern.test(`${root}/${relativePath}`.replaceAll("/", separator)),
);

test("Metro skips generated output and native build trees during Windows file watching", () => {
  for (const directory of [
    ".git", "android/.gradle", "android/build", "android/app/build",
    "android/app/.cxx", "dist", ".expo/onboarding-preview",
    "node_modules/expo-modules-core/android",
    "node_modules/@react-native-firebase/app/android",
    "node_modules/@react-native-firebase/app/ios",
  ]) {
    assert.ok(excluded(directory), directory);
    assert.ok(excluded(`${directory}/nested/output.js`), directory);
    assert.ok(excluded(directory, "\\"), directory);
    assert.ok(excluded(`${directory}/nested/output.js`, "\\"), directory);
  }
});

test("Metro retains app sources, Expo virtual files, assets and dependency JavaScript", () => {
  for (const file of [
    "index.js", "App.js", "src/screens/onboarding/WelcomeScreen.js", "assets/images/logo_t.svg",
    ".expo/.virtual-metro-entry", "node_modules/expo/build/Expo.js",
    "node_modules/firebase/app/dist/index.js", "node_modules/@react-native-firebase/app/lib/index.js",
    "node_modules/react-native/Libraries/Utilities/Platform.android.js",
  ]) {
    assert.equal(excluded(file), false, file);
    assert.equal(excluded(file, "\\"), false, file);
  }
  assert.ok(config.resolver.sourceExts.includes("svg"));
  assert.equal(config.resolver.assetExts.includes("svg"), false);
});
