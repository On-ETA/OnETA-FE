const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const { test } = require('node:test');

function load(file, mocks = {}) {
  const exports = {};
  const { code } = babel.transformSync(fs.readFileSync(file, 'utf8'), {
    configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  vm.runInNewContext(code, { exports, require: name => mocks[name] ?? {} });
  return exports;
}
function fixture({ last, fresh, granted = true } = {}) {
  const calls = [];
  const api = load('src/components/reverseGeocode.js', {
    'react-native': { Platform: { OS: 'android' } },
    'expo-location': {
      Accuracy: { Balanced: 3 },
      getForegroundPermissionsAsync: async () => ({ status: granted ? 'granted' : 'denied' }),
      requestForegroundPermissionsAsync: async () => ({ status: 'denied' }),
      getLastKnownPositionAsync: async options => { calls.push(['cached', options]); return last?.(); },
      getCurrentPositionAsync: async options => { calls.push(['fresh', options]); return fresh?.(); },
    },
    '../utils/currentLocationRequest': {
      createCurrentLocationRequest: lookup => ({ getCoordinate: lookup, getCachedCoordinate: () => null }),
    },
  });
  return { ...api, calls };
}

const position = { coords: { latitude: 37.5, longitude: 127.1 } };

test('usable cached device coordinates skip the fresh lookup and retain age/accuracy limits', async () => {
  const f = fixture({ last: () => position });
  const result = await f.getCurrentCoordinate();
  assert.equal(result.latitude, 37.5);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0][1].maxAge, 60000);
  assert.equal(f.calls[0][1].requiredAccuracy, 200);
});

test('a native last-known-position conversion failure falls back to a fresh lookup', async () => {
  const f = fixture({
    last: () => { throw new Error('The 1st argument cannot be cast to type expo.modules.location.records.LocationLastKnownOptions; java.lang.NullPointerException'); },
    fresh: () => position,
  });
  assert.equal((await f.getCurrentCoordinate()).longitude, 127.1);
  assert.deepEqual(f.calls.map(call => call[0]), ['cached', 'fresh']);
  assert.equal(f.calls[1][1].accuracy, 3);
});

test('missing device cache fetches current coordinates and fresh lookup failures are preserved', async () => {
  const f = fixture({ last: () => null, fresh: () => position });
  assert.equal((await f.getCurrentCoordinate()).latitude, 37.5);
  const denied = Object.assign(new Error('GPS disabled'), { code: 'E_LOCATION_SERVICES_DISABLED' });
  const failure = fixture({ last: () => { throw new Error('cache failed'); }, fresh: () => { throw denied; } });
  await assert.rejects(failure.getCurrentCoordinate(), error => error === denied);
});

test('denied permission prevents both cached and fresh native location calls', async () => {
  const f = fixture({ granted: false });
  await assert.rejects(f.getCurrentCoordinate(), error => error.code === 'LOCATION_PERMISSION_DENIED');
  assert.equal(f.calls.length, 0);
});

test('the Expo Record reflection fix is kept in native and prebuild configurations', () => {
  const native = fs.readFileSync('android/app/proguard-rules.pro', 'utf8');
  const config = JSON.parse(fs.readFileSync('app.json', 'utf8')).expo;
  const properties = config.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-build-properties')[1];
  assert.equal(properties.android.enableMinifyInReleaseBuilds, true);
  for (const rule of ['-keep interface expo.modules.kotlin.records.Record', '-keep @interface expo.modules.kotlin.records.Field { *; }']) {
    assert.ok(native.includes(rule));
    assert.ok(properties.android.extraProguardRules.includes(rule));
  }
});
