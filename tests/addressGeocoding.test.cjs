const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const { test } = require('node:test');
function load(file, mocks = {}, globals = {}) {
  const exports = {};
  const { code } = babel.transformSync(fs.readFileSync(file, 'utf8'), {
    configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  vm.runInNewContext(code, { exports, URLSearchParams, setTimeout, clearTimeout, ...globals, require: name => mocks[name] ?? {} });
  return exports;
}
const road = load('src/utils/roadAddress.js');
const address = '\uC11C\uC6B8\uD2B9\uBCC4\uC2DC \uC911\uAD6C \uC138\uC885\uB300\uB85C 110';
const street = '\uC138\uC885\uB300\uB85C';
const result = { roadAddress: address, x: '126.9784', y: '37.5666' };
function searchFixture(response, geocode) {
  let calls = 0;
  const api = load('src/api/address/search.js', {
    '../auth/tokens': { getAccessToken: () => 'access' },
    '../client': { requestJson: async () => response },
    '../../components/geocodeRoadAddress': { geocodeRoadAddress: request => { calls++; return geocode(request); } },
    '../../utils/roadAddress': road,
  });
  return { ...api, calls: () => calls };
}

test('existing search results and ordinary map searches do not trigger geocoding', async () => {
  const populated = searchFixture({ data: [{ name: 'place', x: 127, y: 37 }] }, () => { throw new Error('unexpected'); });
  assert.equal((await populated.searchAddresses({ keyword: address, fallbackToRoadAddress: true }))[0].name, 'place');
  assert.equal(populated.calls(), 0);
  const empty = searchFixture({ data: [] }, () => { throw new Error('unexpected'); });
  assert.equal((await empty.searchAddresses({ keyword: address })).length, 0);
  assert.equal(empty.calls(), 0);
});

test('empty registration search uses geocoded road address as name/address and preserves numeric coordinates for registration', async () => {
  const f = searchFixture({ data: [] }, async () => [road.roadAddressResult(result)]);
  const found = await f.searchAddresses({ keyword: address, fallbackToRoadAddress: true });
  assert.equal(f.calls(), 1);
  assert.equal(found[0].name, address); assert.equal(found[0].address, address);
  let body;
  const api = load('src/api/addresses.js', {
    './auth/tokens': { getAccessToken: () => 'access' },
    './client': { requestJson: async options => { if (options.method === 'POST') body = options.body; return { data: [] }; } },
    './homeCache': { homeCacheKeys: {}, removeHomeCache() {}, writeHomeCache: (_, value) => value },
  });
  await api.createAddress({ name: found[0].name, address: found[0].address, x: found[0].x, y: found[0].y });
  assert.equal(body.name, address); assert.equal(body.x, 126.9784); assert.equal(body.y, 37.5666);
});

test('a cancelled registration search never returns a late geocoding result', async () => {
  const controller = new AbortController();
  const f = searchFixture({ data: [] }, async () => { controller.abort(); return [result]; });
  await assert.rejects(f.searchAddresses({ keyword: address, fallbackToRoadAddress: true, signal: controller.signal }), { name: 'AbortError' });
});

test('road validation excludes place names, parcel addresses and missing/invalid coordinates', () => {
  assert.equal(road.parseRoadAddress('\uAC15\uB0A8\uC5ED'), null);
  assert.equal(road.parseRoadAddress('\uC11C\uC6B8 \uC5ED\uC0BC\uB3D9 123-4'), null);
  assert.ok(road.parseRoadAddress('\uAD6D\uD68C\uB300\uB85C62\uAE38 9'));
  assert.ok(road.parseRoadAddress('\uACBD\uC778\uB85C \uC9C0\uD558 2'));
  for (const value of [undefined, null, '', 'bad']) assert.equal(road.roadAddressResult({ ...result, x: value }), null);
});

function webFixture() {
  let callback, calls = 0, preloads = 0;
  const Service = { Status: { OK: 'OK' }, geocode(request, done) { calls++; callback = done; assert.equal(request.query, address); } };
  const api = load('src/components/geocodeRoadAddress.web.js', {
    './NaverMapView': { preloadNaverMap: async () => { preloads++; } }, '../utils/roadAddress': road,
  }, { naver: { maps: { Service } } });
  return { ...api, calls: () => calls, preloads: () => preloads, respond: data => callback('OK', { v2: { addresses: data } }) };
}

test('web geocoding exposes only road addresses and ignores a parcel-only response', async () => {
  const f = webFixture();
  const pending = f.geocodeRoadAddress({ keyword: address }); await new Promise(setImmediate);
  f.respond([result, { jibunAddress: 'parcel', x: 127, y: 37 }, { ...result, x: '' }]);
  const found = await pending;
  assert.equal(found.length, 1); assert.equal(found[0].name, address); assert.equal(found[0].x, 126.9784);
  assert.equal((await f.geocodeRoadAddress({ keyword: 'place' })).length, 0);
  assert.equal(f.calls(), 1);
});

test('web abort stops waiting and ignores a later SDK callback', async () => {
  const f = webFixture(), controller = new AbortController();
  const pending = f.geocodeRoadAddress({ keyword: address, signal: controller.signal });
  await new Promise(setImmediate); controller.abort();
  await assert.rejects(pending, { name: 'AbortError' }); f.respond([result]);
});

test('native geocoding uses Android permission and verifies street/building before exposing coordinates', async () => {
  const calls = [];
  const api = load('src/components/geocodeRoadAddress.js', {
    'react-native': { Platform: { OS: 'android' } },
    './reverseGeocode': { ensureForegroundLocationPermission: async () => { calls.push('permission'); } },
    '../utils/roadAddress': road,
    'expo-location': {
      geocodeAsync: async query => { calls.push(query); return [{ latitude: 37.5666, longitude: 126.9784 }]; },
      reverseGeocodeAsync: async () => [{ street, streetNumber: '110' }],
    },
  });
  const found = await api.geocodeRoadAddress({ keyword: address });
  assert.equal(calls[0], 'permission'); assert.equal(calls[1], address);
  assert.equal(found.length, 1); assert.equal(found[0].name, address);
  assert.equal(found[0].x, 126.9784); assert.equal(found[0].y, 37.5666);
});

test('native rejects a nearby road with the wrong building number', async () => {
  const api = load('src/components/geocodeRoadAddress.js', {
    'react-native': { Platform: { OS: 'ios' } }, '../utils/roadAddress': road,
    'expo-location': {
      geocodeAsync: async () => [{ latitude: 37.5666, longitude: 126.9784 }],
      reverseGeocodeAsync: async () => [{ street, streetNumber: '112' }],
    },
  });
  assert.equal((await api.geocodeRoadAddress({ keyword: address })).length, 0);
});
