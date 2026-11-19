const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const { test } = require('node:test');

function load(file, mocks, globals = {}) {
  const exports = {};
  const { code } = babel.transformSync(fs.readFileSync(file, 'utf8'), {
    configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'],
  });
  vm.runInNewContext(code, { exports, AbortController, URLSearchParams, ...globals, require: name => mocks[name] ?? {} });
  return exports;
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}
const settle = () => new Promise(setImmediate);
const dataComparison = load('src/utils/isSameData.js', {});
const response = (routeId = '10', name = 'depot') => ({ code: 'SUCCESS', data: {
  routeId, depotName: name, turnaroundName: 'terminal', depotEnum: 'DEPOT', turnaroundEnum: 'TURNAROUND',
} });
function apiFixture(send) {
  const cache = new Map(), calls = []; let session = 1, now = 1000;
  const api = load('src/api/busRoutes.js', {
    '../utils/isSameData': dataComparison,
    './auth/tokens': { getAccessToken: () => 'token', getAuthSessionId: () => session },
    './client': { requestJson: options => { calls.push(options); return send ? send(options) : Promise.resolve(response()); } },
    './homeCache': { homeCacheKeys: { busRouteDirections: 'directions' },
      readHomeCache: (key, fallback) => cache.get(key) ?? fallback,
      readHomeCacheAsync: async (key, fallback) => cache.get(key) ?? fallback,
      writeHomeCache: (key, value) => cache.set(key, value) },
  }, { Date: { now: () => now } });
  return { api, cache, calls, expire: () => { now += 24 * 60 * 60 * 1000; }, logout: () => { session++; cache.clear(); } };
}

test('directions reuse a route-specific cache; expiry and forced refresh fetch new data', async () => {
  const f = apiFixture();
  await f.api.getBusRouteDirections({ routeId: '10' });
  assert.equal(f.api.getCachedBusRouteDirections(10).depotName, 'depot');
  assert.equal(f.api.getCachedBusRouteDirections('11'), null);
  await f.api.getBusRouteDirections({ routeId: '10' }); assert.equal(f.calls.length, 1);
  await f.api.getBusRouteDirections({ routeId: '10', forceRefresh: true }); assert.equal(f.calls.length, 2);
  f.expire(); assert.equal(f.api.getCachedBusRouteDirections('10'), null);
  await f.api.getBusRouteDirections({ routeId: '10' }); assert.equal(f.calls.length, 3);
});

test('failed revalidation preserves usable directions and malformed data never enters cache', async () => {
  let result = response();
  const f = apiFixture(async () => { if (result instanceof Error) throw result; return result; });
  await f.api.getBusRouteDirections({ routeId: '10' });
  result = new Error('offline');
  await assert.rejects(f.api.getBusRouteDirections({ routeId: '10', forceRefresh: true }), /offline/);
  assert.equal(f.api.getCachedBusRouteDirections('10').depotName, 'depot');
  result = response('wrong');
  await assert.rejects(f.api.getBusRouteDirections({ routeId: '10', forceRefresh: true }), /올바르지/);
  assert.equal(f.api.getCachedBusRouteDirections('10').routeId, '10');
});

test('logout and cancellation prevent late direction responses from repopulating cache', async () => {
  for (const logout of [true, false]) {
    const request = deferred(), f = apiFixture(() => request.promise), controller = new AbortController();
    const pending = f.api.getBusRouteDirections({ routeId: '10', forceRefresh: true, signal: controller.signal });
    if (logout) f.logout(); else controller.abort();
    request.resolve(response());
    await assert.rejects(pending, error => error.name === 'AbortError');
    assert.equal(f.cache.size, 0);
  }
});

test('partial direction responses remain usable without replacing a complete cache', async () => {
  let result = response();
  const f = apiFixture(async () => result);
  await f.api.getBusRouteDirections({ routeId: '10' });
  result = response(); result.data.turnaroundName = '';
  const partial = await f.api.getBusRouteDirections({ routeId: '10', forceRefresh: true });
  assert.equal(partial.depotName, 'depot');
  assert.equal(f.api.getCachedBusRouteDirections('10').turnaroundName, 'terminal');
});

test('an older direction response cannot overwrite a newer request for the same route', async () => {
  const first = deferred(), second = deferred(); let count = 0;
  const f = apiFixture(() => ++count === 1 ? first.promise : second.promise);
  const old = f.api.getBusRouteDirections({ routeId: '10', forceRefresh: true });
  const latest = f.api.getBusRouteDirections({ routeId: '10', forceRefresh: true });
  second.resolve(response('10', 'new')); await latest;
  first.resolve(response('10', 'old')); await assert.rejects(old, error => error.name === 'AbortError');
  assert.equal(f.api.getCachedBusRouteDirections('10').depotName, 'new');
});

function renderer() {
  const slots = [], effects = []; let cursor = 0, unmounted = false, lateWrites = 0, changes = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useMemo: fn => fn(), useRef: value => slots[cursor++] ??= { current: value },
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { if (unmounted) lateWrites++; const next = typeof value === 'function' ? value(slots[index]) : value;
        if (!Object.is(slots[index], next)) changes++; slots[index] = next; }]; },
    useEffect(fn, deps) { const index = cursor++, prior = slots[index];
      if (!prior || deps.some((value, i) => !Object.is(value, prior.deps[i]))) {
        slots[index] = { deps, cleanup: prior?.cleanup }; effects.push(() => { slots[index].cleanup?.(); slots[index].cleanup = fn(); });
      } },
  };
  return { react, render(Component, props) { cursor = 0; return Component(props); }, flush() { effects.splice(0).forEach(fn => fn()); },
    unmount() { unmounted = true; slots.forEach(slot => slot?.cleanup?.()); }, lateWrites: () => lateWrites, changes: () => changes };
}
function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return;
  if (!Array.isArray(tree) && predicate(tree)) return tree;
  for (const child of Array.isArray(tree) ? tree : tree.children ?? []) { const result = find(child, predicate); if (result) return result; }
}
function text(tree) { return typeof tree === 'string' ? tree : (Array.isArray(tree) ? tree : tree?.children ?? []).map(text).join(''); }
function button(tree, label) { return find(tree, node => node.type === 'Pressable' && text(node) === label); }
const alarm = { notificationId: 1, routeName: 'cached', targetArrivalTime: '09:00', repeatDays: ['MON'], reminderOffsetMinutes: [10], route: { segments: [] } };
function screenFixture({ garage = false, cached = null, detail, fallback } = {}) {
  const view = renderer(), request = deferred(), calls = [], saves = [], alerts = [];
  const patch = load('src/utils/arrivalNotificationPatch.js', {});
  const api = load('src/screens/home/custom-alarm/CustomAlarmEditScreen.js', {
    react: view.react,
    'react-native': { View: 'View', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable', StyleSheet: { create: value => value }, Alert: { alert: (...args) => alerts.push(args) } },
    '../../../theme': { colors: {}, typography: {} },
    '../../../components/DelayedLoading': { DelayedLoading: 'DelayedLoading' },
    '../../../utils/routeSegments': { normalizeTimelineSegments: value => value },
    '../../../utils/arrivalNotificationPatch': patch,
    '../../../utils/isSameData': dataComparison,
    '../../../api/notifications/arrival': {
      getArrivalNotificationById: options => { calls.push(options); return detail ? detail(options) : request.promise; },
      getArrivalNotifications: fallback,
      updateArrivalNotification: async options => { saves.push(options); },
    },
    '../../../api/busRoutes': {
      getCachedBusRouteDirections: () => cached, getCachedBusRouteDirectionsAsync: async () => cached,
      getBusRouteDirections: options => { calls.push(options); return request.promise; },
    },
    '../../../api/notifications/depot': { updateDepotNotification: async options => { saves.push(options); } },
  });
  const props = { alarm: garage ? { userBusId: 1, routeId: '10', directionType: 'DEPOT' } : alarm };
  const Component = garage ? api.GarageDepartureAlarmEditScreen : api.ScheduleAlarmEditScreen;
  return { ...view, request, calls, saves, alerts, render: () => view.render(Component, props) };
}

test('schedule content is immediate and a late refresh preserves edited name, days and reminders', async () => {
  const f = screenFixture(); const first = f.render();
  assert.equal(find(first, node => node.type === 'TextInput').props.value, 'cached');
  f.flush(); assert.equal(find(f.render(), node => node.type === 'DelayedLoading'), undefined);
  find(f.render(), node => node.type === 'TextInput').props.onChangeText('my edit');
  button(f.render(), '화').props.onPress();
  const modal = find(f.render(), node => typeof node.props.onToggle === 'function'); modal.props.onToggle(30);
  f.request.resolve({ ...alarm, routeName: 'server', repeatDays: ['FRI'], reminderOffsetMinutes: [5] }); await settle();
  const updated = f.render();
  assert.equal(find(updated, node => node.type === 'TextInput').props.value, 'my edit');
  assert.equal(button(updated, '월').props.accessibilityState.selected, true);
  assert.equal(button(updated, '화').props.accessibilityState.selected, true);
  await button(updated, '저장').props.onPress();
  assert.equal(f.saves[0].payload.routeName, 'my edit');
  assert.deepEqual(Array.from(f.saves[0].payload.repeatDays), ['MON', 'TUE']);
  assert.deepEqual(Array.from(f.saves[0].payload.reminderOffsetMinutes), [10, 30]); f.unmount();
});

test('saving during revalidation sends only edited fields and ignores its late response', async () => {
  const f = screenFixture(); f.render(); f.flush();
  find(f.render(), node => node.type === 'TextInput').props.onChangeText('saved');
  await button(f.render(), '저장').props.onPress();
  assert.equal(JSON.stringify(f.saves[0].payload), JSON.stringify({ routeName: 'saved' }));
  assert.equal(f.calls[0].signal.aborted, true);
  f.request.resolve({ ...alarm, routeName: 'late' }); await settle();
  assert.equal(find(f.render(), node => node.type === 'TextInput').props.value, 'saved'); f.unmount();
});

test('a fallback detail response after leaving never updates an unmounted form', async () => {
  const fallback = deferred();
  const f = screenFixture({ detail: async () => { throw new Error('detail failed'); }, fallback: () => fallback.promise });
  f.render(); f.flush(); await settle(); f.unmount();
  fallback.resolve([alarm]); await settle(); assert.equal(f.lateWrites(), 0);
});

test('cached garage directions are immediately selectable and revalidation preserves the selection', async () => {
  const cacheApi = apiFixture(); const cached = await cacheApi.api.getBusRouteDirections({ routeId: '10' });
  const f = screenFixture({ garage: true, cached }); const first = f.render();
  assert.ok(button(first, 'terminal 방면terminal 정류장에서 출고 시 1회 알림'));
  f.flush(); await settle();
  button(f.render(), 'terminal 방면terminal 정류장에서 출고 시 1회 알림').props.onPress();
  assert.equal(button(f.render(), '저장').props.disabled, false);
  f.request.resolve({ ...cached, depotName: 'updated depot' }); await settle();
  assert.equal(button(f.render(), 'terminal 방면terminal 정류장에서 출고 시 1회 알림').props.accessibilityState.selected, true);
  await button(f.render(), '저장').props.onPress();
  assert.equal(f.saves[0].payload.direction, 'TURNAROUND'); assert.equal(f.saves[0].payload.directionName, 'terminal'); f.unmount();
});

test('failed garage revalidation retains cached choices without a blocking alert', async () => {
  const cacheApi = apiFixture(), cached = await cacheApi.api.getBusRouteDirections({ routeId: '10' });
  const f = screenFixture({ garage: true, cached }); f.render(); f.flush(); await settle();
  f.request.reject(new Error('offline')); await settle();
  assert.equal(button(f.render(), '저장').props.disabled, false); assert.equal(f.alerts.length, 0); f.unmount();
});

test('identical schedule refresh preserves state references and never reopens loading', async () => {
  const f = screenFixture(); f.render(); f.flush();
  assert.equal(f.changes(), 0);
  // Detail-only metadata and property order must not replace the visible form.
  f.request.resolve({ ...alarm, raw: { serverMetadata: 'detail response' }, route: { segments: [] } });
  await settle(); assert.equal(f.changes(), 0);
  assert.equal(find(f.render(), node => node.type === 'DelayedLoading'), undefined); f.unmount();
});

test('identical garage refresh and async cache hydration do not update screen state', async () => {
  const cacheApi = apiFixture(), cached = await cacheApi.api.getBusRouteDirections({ routeId: '10' });
  const f = screenFixture({ garage: true, cached }); f.render(); f.flush(); await settle();
  assert.equal(f.changes(), 0);
  f.request.resolve(JSON.parse(JSON.stringify(cached))); await settle();
  assert.equal(f.changes(), 0); f.unmount();
});

test('identical direction responses reuse the cached object even when property order differs', async () => {
  let result = response(); const f = apiFixture(async () => result);
  const cached = await f.api.getBusRouteDirections({ routeId: '10' });
  result = { data: { turnaroundEnum: 'TURNAROUND', turnaroundName: 'terminal', depotEnum: 'DEPOT', depotName: 'depot', routeId: '10' }, code: 'SUCCESS' };
  const refreshed = await f.api.getBusRouteDirections({ routeId: '10', forceRefresh: true });
  assert.equal(refreshed, cached);
});
