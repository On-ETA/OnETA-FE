const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const babel = require('@babel/core');
function load(file, mocks = {}) {
  const exports = {};
  const { code } = babel.transformSync(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  vm.runInNewContext(code, { exports, URLSearchParams, require(name) {
    if (!(name in mocks)) throw new Error(name);
    return mocks[name];
  }});
  return exports;
}
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/schedule-route-detail.json'), 'utf8'));
const { getRouteSetupPlaces } = load('src/utils/routeSetupPlaces.js');

test('schedule detail restores actual origin/destination coordinates including walking segments', () => {
  for (const values of [fixture, fixture.data, { routeDetails: JSON.stringify({ route: fixture.data.route }) }]) {
    const places = getRouteSetupPlaces(values);
    assert.equal(places.origin.x, 126.925554591431);
    assert.equal(places.origin.y, 37.550874837441);
    assert.equal(places.destination.x, 126.914234922156);
    assert.equal(places.destination.y, 37.5594419505475);
    assert.equal(places.origin.address, fixture.data.route.originAddress);
    assert.equal(places.destination.address, fixture.data.route.destinationAddress);
  }
});

test('restored places produce the correct search query, not bus boarding/alighting coordinates', async () => {
  let request;
  const api = load('src/api/transit/routes.js', {
    '../auth/tokens': { getAccessToken: () => 'access' },
    '../auth/reissue': { reissueAuthTokens: async () => { throw new Error('unexpected refresh'); } },
    '../client': { requestJson: async options => { request = options; return { code: 'SUCCESS', data: [] }; } },
    '../homeCache': { homeCacheKeys: { transitRouteSearch: 'search' }, readHomeCacheAsync: async () => null, writeHomeCacheAsync: async () => {} },
  });
  const { origin, destination } = getRouteSetupPlaces(fixture.data);
  await api.searchTransitRoutes({ originX: origin.x, originY: origin.y, originAddress: origin.address,
    destX: destination.x, destY: destination.y, destAddress: destination.address, scheduleType: fixture.data.scheduleType });
  assert.equal(request.method, 'GET');
  assert.equal(request.path.split('?')[0], '/api/transit/routes/search');
  const query = new URLSearchParams(request.path.split('?')[1]);
  for (const [key, value] of Object.entries({ originX: origin.x, originY: origin.y, destX: destination.x, destY: destination.y,
    originAddress: origin.address, destAddress: destination.address, scheduleType: 'NORMAL' })) assert.equal(query.get(key), String(value));
});

test('explicit saved places take priority and normalized segments retain endpoint coordinates', () => {
  const explicit = getRouteSetupPlaces({ route: fixture.data.route,
    routePlaces: { origin: { name: 'new origin', x: '127.1', y: '37.1' }, destination: { name: 'new destination', x: '127.2', y: '37.2' } } });
  assert.equal(explicit.origin.x, 127.1);
  assert.equal(explicit.destination.y, 37.2);
  const normalized = { ...fixture.data.route, segments: fixture.data.route.segments.map(raw => ({ transitType: raw.transitType, raw })) };
  const places = getRouteSetupPlaces({ route: normalized });
  assert.equal(places.origin.x, 126.925554591431);
  assert.equal(places.destination.y, 37.5594419505475);
});

test('missing coordinates stay absent rather than becoming zero', () => {
  const places = getRouteSetupPlaces({ route: { originAddress: 'origin', segments: [{ startX: null, startY: '', endX: null, endY: null }] } });
  assert.equal(places.origin.x, undefined);
  assert.equal(places.destination.y, undefined);
});

test('time-only reset restores coordinate-only addresses and sends all required coordinates', async () => {
  let request;
  const api = load('src/api/transit/routes.js', {
    '../auth/tokens': { getAccessToken: () => 'access' },
    '../auth/reissue': { reissueAuthTokens: async () => { throw new Error('unexpected refresh'); } },
    '../client': { requestJson: async options => { request = options; return { code: 'SUCCESS', data: [] }; } },
    '../homeCache': { homeCacheKeys: { transitRouteSearch: 'search' }, readHomeCacheAsync: async () => null, writeHomeCacheAsync: async () => {} },
  });
  const initialValues = { arrivalTime: '13:25:00', routeDetails: {
    route: { originAddress: '37.565774, 126.924854', destinationAddress: '37.582594, 126.939724', segments: [] },
  } };
  const { origin, destination } = getRouteSetupPlaces(initialValues);
  await api.searchTransitRoutes({ originX: origin.x, originY: origin.y, originAddress: origin.address,
    destX: destination.x, destY: destination.y, destAddress: destination.address, scheduleType: 'NORMAL' });
  const query = new URLSearchParams(request.path.split('?')[1]);
  for (const [key, value] of Object.entries({ originX: '126.924854', originY: '37.565774',
    destX: '126.939724', destY: '37.582594', originAddress: '37.565774, 126.924854',
    destAddress: '37.582594, 126.939724', scheduleType: 'NORMAL' })) assert.equal(query.get(key), value);
});

test('coordinate text is a fallback and never replaces saved endpoint coordinates', () => {
  const places = getRouteSetupPlaces({ routeDetails: {
    route: fixture.data.route, origin: '37.565774, 126.924854', destination: '37.582594, 126.939724',
  } });
  assert.equal(places.origin.x, 126.925554591431);
  assert.equal(places.origin.y, 37.550874837441);
  assert.equal(places.destination.x, 126.914234922156);
  assert.equal(places.destination.y, 37.5594419505475);
});

test('ordinary addresses and invalid coordinate text do not fabricate coordinates', () => {
  for (const address of ['서울 마포구 와우산로 94', '91, 126.924854', '37.565774, 181', '37.565774, 126.924854 extra']) {
    const places = getRouteSetupPlaces({ routeDetails: { origin: address, destination: address } });
    assert.equal(places.origin.x, undefined);
    assert.equal(places.origin.y, undefined);
    assert.equal(places.destination.x, undefined);
    assert.equal(places.destination.y, undefined);
  }
});
