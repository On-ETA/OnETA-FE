const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const { test } = require('node:test');

function load(modulePath, mocks, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', modulePath), 'utf8');
  const { code } = babel.transformSync(source, {
    configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  const exports = {};
  vm.runInNewContext(code, {
    exports, Date, URLSearchParams, console, ...globals,
    require: key => {
      if (!(key in mocks)) throw new Error('Unexpected import: ' + key);
      return mocks[key];
    },
  });
  return exports;
}

test('first/last search times identify the Seoul operating date across midnight', () => {
  const { formatSeoulDateTimeLabel, parseEstimatedDepartureAt } = load(
    'src/utils/firstLastRouteSummary.js', { './routeSegments': { normalizeTimelineSegments: x => x } },
  );
  const nextMidnight = parseEstimatedDepartureAt('2026-10-09T00:10:00+09:00');
  assert.equal(formatSeoulDateTimeLabel(nextMidnight, Date.parse('2026-10-08T14:59:00Z')), '내일 00:10');
  assert.equal(formatSeoulDateTimeLabel(nextMidnight, Date.parse('2026-10-08T15:01:00Z')), '오늘 00:10');
  const nextNight = parseEstimatedDepartureAt('2026-10-09T23:00:00+09:00');
  assert.equal(formatSeoulDateTimeLabel(nextNight, Date.parse('2026-10-08T14:59:00Z')), '내일 23:00');
});

test('first/last route search invalidates a cached 23:59 result at Seoul midnight', async () => {
  const savedAt = Date.parse('2026-10-08T14:59:59Z');
  const now = Date.parse('2026-10-08T15:00:01Z');
  class FixedDate extends Date { static now() { return now; } }
  const options = { originX: 126.9, originY: 37.5, destX: 126.92, destY: 37.55, scheduleType: 'LAST_TRANSIT' };
  const requestPath = '/api/transit/routes/first-last/search?originX=126.9&originY=37.5&destX=126.92&destY=37.55&scheduleType=LAST_TRANSIT';
  let requests = 0;
  const cachedSearches = { searches: {
    [requestPath]: { version: 2, savedAt, routes: [{ routeId: 'stale', segments: [] }], ttlMs: 60000 },
  } };
  const routes = load('src/api/transit/routes.js', {
    '../auth/tokens': { getAccessToken: () => 'token' },
    '../auth/reissue': { reissueAuthTokens: async () => { throw new Error('unexpected'); } },
    '../client': { requestJson: async () => { requests++; return { code: 'SUCCESS', data: [] }; } },
    '../homeCache': {
      homeCacheKeys: { transitRouteSearch: 'routes' },
      readHomeCacheAsync: async () => cachedSearches,
      writeHomeCacheAsync: async () => {},
    },
  }, { Date: FixedDate });
  await routes.searchFirstLastTransitRoutes(options);
  assert.equal(requests, 1);
});

test('first/last POST forwards the exact selected date and offset to the backend', async () => {
  const requests = [];
  const transit = load('src/api/notifications/transit.js', {
    '../auth/tokens': { getAccessToken: () => 'token', getAuthSessionId: () => 'session' },
    '../auth/reissue': { reissueAuthTokens: async () => { throw new Error('unexpected'); } },
    '../client': { requestJson: async options => {
      requests.push(options);
      return options.method === 'POST' ? { code: 'SUCCESS', data: 134 } : { code: 'SUCCESS', data: [] };
    } },
    '../homeCache': {
      homeCacheKeys: { firstTransitNotifications: 'first', lastTransitNotifications: 'last' },
      readHomeCacheAsync: async () => null, writeHomeCacheAsync: async () => {},
      removeHomeCache: () => {},
    },
  });
  await transit.createTransitNotification({ payload: {
    scheduleType: 'LAST_TRANSIT',
    routeDetails: '{}',
    reminderOffsetMinutes: [5],
    selectedDepartureAt: '2026-10-09T00:10:00+09:00',
  } });
  const post = requests.find(x => x.method === 'POST');
  assert.equal(post.path, '/api/notifications/transit');
  assert.equal(post.body.selectedDepartureAt, '2026-10-09T00:10:00+09:00');
});
