const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const babel = require('@babel/core');

function load(file, globals = {}) {
  const exports = {};
  const { code } = babel.transformSync(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  vm.runInNewContext(code, { exports, AbortController, require: () => ({}), ...globals });
  return exports;
}

function fixture(refresh, currentState = 'active') {
  const intervals = [];
  let onState;
  let removed = false;
  const api = load('src/utils/transitRefresh.js', {
    setInterval: (callback, delay) => { const timer = { callback, delay }; intervals.push(timer); return timer; },
    clearInterval: timer => { if (timer) timer.cancelled = true; },
  });
  const stop = api.startTransitRefresh({ refresh, appState: { currentState,
    addEventListener: (_, callback) => { onState = callback; return { remove() { removed = true; } }; },
  } });
  return { intervals, stop, state: value => onState(value), removed: () => removed };
}

test('refreshes every five minutes, pauses in background, and forces a refresh on return', async () => {
  const calls = [];
  const f = fixture(async options => calls.push(options));
  await new Promise(setImmediate);
  assert.equal(calls[0].forceRefresh, false);
  assert.equal(f.intervals[0].delay, 300000);
  await f.intervals[0].callback();
  await new Promise(setImmediate);
  assert.equal(calls[1].forceRefresh, true);
  f.state('background');
  assert.equal(f.intervals[0].cancelled, true);
  await f.intervals[0].callback();
  assert.equal(calls.length, 2);
  f.state('active');
  await new Promise(setImmediate);
  assert.equal(calls.length, 3);
  assert.equal(calls[2].forceRefresh, true);
  f.state('active');
  assert.equal(calls.length, 3);
  f.stop();
  assert.equal(f.removed(), true);
  assert.equal(f.intervals[1].cancelled, true);
});

test('does not overlap requests and ignores timers after the screen is closed', async () => {
  const calls = [];
  const resolvers = [];
  const f = fixture(options => { calls.push(options); return new Promise(resolve => resolvers.push(resolve)); });
  f.intervals[0].callback();
  assert.equal(calls.length, 1);
  resolvers[0]();
  await new Promise(setImmediate);
  assert.equal(calls.length, 2);
  f.stop();
  assert.equal(calls[1].signal.aborted, true);
  resolvers[1]();
  await new Promise(setImmediate);
  f.intervals[0].callback();
  assert.equal(calls.length, 2);
});

test('a screen opened in the background waits until the app returns', async () => {
  const calls = [];
  const f = fixture(async options => calls.push(options), 'background');
  assert.equal(calls.length, 0);
  assert.equal(f.intervals.length, 0);
  f.state('active');
  await new Promise(setImmediate);
  assert.equal(calls[0].forceRefresh, true);
  f.stop();
});

test('display time is corrected against departure timestamp or elapsed time without accumulating drift', () => {
  const api = load('src/utils/firstLastRouteSummary.js');
  const now = 1000000;
  assert.equal(api.getCorrectedRemainingMinutes({ estimatedDepartureTimestamp: now + 60000, remainingMinutes: 20 }, now), 1);
  const summary = { remainingMinutes: 10, remainingTimeUpdatedAt: now };
  assert.equal(api.getCorrectedRemainingMinutes(summary, now + 3 * 60000), 7);
  assert.equal(api.getCorrectedRemainingMinutes(summary, now + 4 * 60000), 6);
  assert.equal(api.getCorrectedRemainingMinutes(summary, now + 11 * 60000), 0);
  assert.equal(api.getCorrectedRemainingMinutes({}, now), undefined);
});
