const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const ignore = require('ignore');

const gitPolicy = ignore().add(fs.readFileSync('.gitignore', 'utf8'));
const easPolicy = ignore().add(fs.readFileSync('.easignore', 'utf8'));

test('Git and EAS exclude private credentials and generated native artifacts', () => {
  for (const file of ['credentials.json', 'credentials/android/keystore.jks', '.env', '.env.production',
    '.aws/credentials', '.npmrc', 'release.jks', 'signing.p12', 'AuthKey.p8', 'app-release.aab',
    'android/app/build/outputs/bundle/release/app-release.aab', 'android/local.properties', '.idea/workspace.xml']) {
    assert.equal(gitPolicy.ignores(file), true, `git: ${file}`);
    assert.equal(easPolicy.ignores(file), true, `eas: ${file}`);
  }
});

test('EAS excludes dev-only sources while retaining runtime assets and installation scripts', () => {
  for (const file of ['tests/fixture.json', 'src/api/test/fcm.js', 'docs/notes.md', '.vscode/settings.json', 'dist/index.html', '.tools/cache.bin']) {
    assert.equal(easPolicy.ignores(file), true, file);
  }
  for (const file of ['App.js', 'index.js', 'app.json', 'src/screens/HomeScreen.js', 'assets/images/logo_t.svg',
    'public/images/memo.svg', 'google-services.json', 'android/app/google-services.json',
    'android/app/debug.keystore', 'scripts/patch-naver-map-loaded.cjs', 'package-lock.json', '.env.example']) {
    assert.equal(easPolicy.ignores(file), false, file);
  }
});
