const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const { test } = require('node:test');
function load(file, mocks = {}, globals = {}) {
  const exports = {};
  const { code } = babel.transformSync(fs.readFileSync(file, 'utf8'), { configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs', '@babel/plugin-transform-react-jsx'] });
  vm.runInNewContext(code, { exports, AbortController, ...globals, require: name => mocks[name] ?? {} });
  return exports;
}
const types = { first: 'FIRST_TRANSIT', last: 'LAST_TRANSIT' };
const api = load('src/utils/firstLastDisplay.js');
const timestamp = value => Date.parse(value + '+09:00');

test('a sole first/last alarm wins regardless of time; both or neither use Seoul noon/midnight boundaries', () => {
  for (const [time, expected] of [
    ['2026-10-11T00:00:00', types.first], ['2026-10-11T11:59:59', types.first],
    ['2026-10-11T12:00:00', types.last], ['2026-10-11T23:59:59', types.last],
    ['2026-10-12T00:00:00', types.first],
  ]) {
    const now = timestamp(time);
    for (const present of [false, true]) {
      assert.equal(api.getPreferredTransitType({ hasFirst: present, hasLast: present, now, types }), expected);
    }
    assert.equal(api.getPreferredTransitType({ hasFirst: true, hasLast: false, now, types }), types.first);
    assert.equal(api.getPreferredTransitType({ hasFirst: false, hasLast: true, now, types }), types.last);
  }
});

test('the clock updates exactly at noon/midnight, pauses in background and updates on resume', () => {
  let current = timestamp('2026-10-11T11:59:59'), listener;
  const timers = [], updates = [];
  const appState = { currentState: 'active', addEventListener(_, callback) { listener = callback; return { remove() { listener = null; } }; } };
  const stop = api.startFirstLastClock({ appState, now: () => current, onChange: value => updates.push(value),
    setTimer(fn, delay) { const timer = { fn, delay }; timers.push(timer); return timer; }, clearTimer(timer) { if (timer) timer.cancelled = true; } });
  assert.equal(timers[0].delay, 1000);
  current += 1000; timers[0].fn();
  assert.equal(updates.at(-1), timestamp('2026-10-11T12:00:00'));
  assert.equal(timers.at(-1).delay, 12 * 60 * 60 * 1000);
  listener('background'); assert.equal(timers.at(-1).cancelled, true);
  current = timestamp('2026-10-12T00:01:00'); listener('active');
  assert.equal(updates.at(-1), current);
  const pending = timers.at(-1); stop(); assert.equal(pending.cancelled, true);
  const before = updates.length; pending.fn(); assert.equal(updates.length, before);
});

function homeFixture({ first = true, last = true, time = '2026-10-11T13:00:00' } = {}) {
  const slots = [], effects = [];
  let cursor = 0, current = timestamp(time), clockCallback, refresh;
  const cache = new Map();
  for (const [present, type] of [[first, types.first], [last, types.last]]) {
    if (present) cache.set(type, { cacheVersion: 2, scheduleType: type, notificationId: type });
  }
  class ClockDate extends Date { static now() { return current; } }
  const display = load('src/utils/firstLastDisplay.js', {}, { Date: ClockDate });
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }), memo: component => component,
    useCallback: fn => fn,
    useRef: value => slots[cursor++] ??= { current: value },
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useEffect(fn, deps) {
      const index = cursor++, prior = slots[index];
      if (!prior || deps.some((value, i) => !Object.is(value, prior.deps[i]))) {
        slots[index] = { deps, cleanup: prior?.cleanup };
        effects.push(() => { slots[index].cleanup?.(); slots[index].cleanup = fn(); });
      }
    },
  };
  const screen = load('src/screens/HomeScreen.js', {
    react, 'react-native': { Platform: { OS: 'web', select: options => options.web }, StyleSheet: { create: value => value } },
    '../theme': { colors: {}, layout: {} },
    '../utils/firstLastDisplay': { ...display, startFirstLastClock: ({ onChange }) => { clockCallback = onChange; return () => {}; } },
    '../utils/transitRefresh': { startTransitRefresh: ({ refresh: fn }) => { refresh = fn; return () => {}; } },
    '../api/addresses': { getAddresses: async () => [] },
    '../notifications/events': { FCM_NOTIFICATION_TYPES: {}, subscribeNotifications: () => () => {} },
    '../api/homeCache': { homeCacheKeys: { firstTransitRoute: types.first, lastTransitRoute: types.last },
      readHomeCache: key => cache.get(key), removeHomeCache: key => cache.delete(key) },
    '../api/notifications/transit': { TRANSIT_SCHEDULE_TYPES: types, getTransitNotifications: async () => [] },
  }, { Date: ClockDate });
  function findDashboard(tree) {
    if (!tree || typeof tree !== 'object') return undefined;
    if (tree.props?.onFirstLastScheduleTypeChange) return tree.props;
    for (const child of Array.isArray(tree) ? tree : tree.children ?? []) {
      const found = findDashboard(child); if (found) return found;
    }
  }
  return {
    render() { cursor = 0; return findDashboard(screen.HomeScreen({})); },
    flush() { effects.splice(0).forEach(fn => fn()); },
    setTime(value) { current = timestamp(value); clockCallback(current); },
    refresh: () => refresh({}),
  };
}

test('home starts with the sole alarm, keeps manual switches until noon/midnight and then applies the time default', () => {
  const onlyLast = homeFixture({ first: false, time: '2026-10-11T08:00:00' });
  assert.equal(onlyLast.render().activeFirstLastScheduleType, types.last);
  const both = homeFixture();
  assert.equal(both.render().activeFirstLastScheduleType, types.last); both.flush();
  both.render().onFirstLastScheduleTypeChange(types.first); both.render(); both.flush();
  assert.equal(both.render().activeFirstLastScheduleType, types.first);
  both.setTime('2026-10-12T00:00:00'); both.render(); both.flush();
  assert.equal(both.render().activeFirstLastScheduleType, types.first);
  both.setTime('2026-10-12T12:00:00'); both.render(); both.flush();
  assert.equal(both.render().activeFirstLastScheduleType, types.last);
});

test('removing both alarms through refresh falls back to the current time instead of retaining a manual choice', async () => {
  const f = homeFixture(); f.render(); f.flush();
  f.render().onFirstLastScheduleTypeChange(types.first); f.render(); f.flush();
  await f.refresh(); f.render(); f.flush();
  const dashboard = f.render();
  assert.equal(dashboard.activeFirstLastScheduleType, types.last);
  assert.equal(dashboard.firstLastRouteSummary, null);
});
