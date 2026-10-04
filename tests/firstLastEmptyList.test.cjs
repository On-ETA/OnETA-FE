const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const babel = require('@babel/core');

function fixture(scheduleType, result) {
  const types = { first: 'FIRST_TRANSIT', last: 'LAST_TRANSIT' };
  const keys = { firstTransitRoute: 'first-route', lastTransitRoute: 'last-route' };
  const first = { cacheVersion: 2, scheduleType: types.first, notificationId: 1 };
  const last = { cacheVersion: 2, scheduleType: types.last, notificationId: 2 };
  const cache = new Map([['first-route', first], ['last-route', last]]);
  const state = [];
  const effects = [];
  const requests = [];
  const react = {
    createElement: () => null, memo: component => component,
    useCallback: callback => callback, useRef: value => ({ current: value }),
    useEffect: effect => effects.push(effect),
    useState(initial) {
      const entry = { value: typeof initial === 'function' ? initial() : initial };
      if (entry.value === types.first) entry.value = scheduleType;
      state.push(entry);
      return [entry.value, next => { entry.value = typeof next === 'function' ? next(entry.value) : next; }];
    },
  };
  const mocks = {
    react,
    'react-native': { Platform: { OS: 'web', select: value => value.web }, StyleSheet: { create: value => value },
      AppState: { addEventListener: () => ({ remove() {} }) } },
    '../api/homeCache': { homeCacheKeys: keys, readHomeCache: (key, fallback) => cache.get(key) ?? fallback,
      writeHomeCache: (key, value) => cache.set(key, value), removeHomeCache: key => cache.delete(key) },
    '../api/addresses': { getAddresses: async () => [] },
    '../api/notifications/transit': { TRANSIT_SCHEDULE_TYPES: types, getTransitNotifications: async options => {
      requests.push(options); if (result instanceof Error) throw result; return result;
    } },
    '../theme': { colors: {}, layout: {} },
    '../utils/firstLastRouteSummary': { createFirstLastRouteSummary: () => ({ segments: [] }), parseEstimatedDepartureAt: () => undefined,
      formatSeoulTime: () => undefined },
  };
  const filename = path.join(__dirname, '../src/screens/HomeScreen.js');
  const { code } = babel.transformSync(fs.readFileSync(filename, 'utf8'), { configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'] });
  const exports = {};
  vm.runInNewContext(code, { exports, AbortController, console: { warn() {} }, require: name => mocks[name] ?? {} });
  exports.HomeScreen({});
  return { cache, state, effects, requests, first, last };
}

async function runEffects(f) {
  f.effects.forEach(effect => effect());
  await new Promise(resolve => setImmediate(resolve));
}

test('empty last-transit response clears the cached last route and screen while preserving the first route', async () => {
  const f = fixture('LAST_TRANSIT', []);
  await runEffects(f);
  assert.equal(f.requests[0].scheduleType, 'LAST_TRANSIT');
  const summaries = f.state.find(entry => entry.value && typeof entry.value === 'object' && 'FIRST_TRANSIT' in entry.value).value;
  assert.equal(summaries.LAST_TRANSIT, null);
  assert.equal(f.cache.has('last-route'), false);
  assert.equal(summaries.FIRST_TRANSIT, f.first);
  assert.equal(f.cache.get('first-route'), f.first);
});

test('empty first-transit response clears only the first route', async () => {
  const f = fixture('FIRST_TRANSIT', []);
  await runEffects(f);
  const summaries = f.state.find(entry => entry.value && typeof entry.value === 'object' && 'FIRST_TRANSIT' in entry.value).value;
  assert.equal(summaries.FIRST_TRANSIT, null);
  assert.equal(f.cache.has('first-route'), false);
  assert.equal(summaries.LAST_TRANSIT, f.last);
});

test('network errors do not erase the last known route', async () => {
  const f = fixture('LAST_TRANSIT', new Error('offline'));
  await runEffects(f);
  const summaries = f.state.find(entry => entry.value && typeof entry.value === 'object' && 'FIRST_TRANSIT' in entry.value).value;
  assert.equal(summaries.LAST_TRANSIT, f.last);
  assert.equal(f.cache.get('last-route'), f.last);
});
