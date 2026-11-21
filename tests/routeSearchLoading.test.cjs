const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const { test } = require('node:test');
function renderer() {
  const slots = [], effects = []; let cursor = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useMemo: fn => fn(), useRef: value => slots[cursor++] ??= { current: value },
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useEffect(fn, deps) { const index = cursor++, prior = slots[index];
      if (!prior || deps.some((value, i) => !Object.is(value, prior.deps[i]))) {
        slots[index] = { deps, cleanup: prior?.cleanup };
        effects.push(() => { slots[index].cleanup?.(); slots[index].cleanup = fn(); });
      } },
  };
  return { react, render(Component, props) { cursor = 0; return Component(props); }, flush() { effects.splice(0).forEach(fn => fn()); }, unmount() { slots.forEach(slot => slot?.cleanup?.()); } };
}
function load(file, mocks, globals = {}) {
  const exports = {};
  const { code } = babel.transformSync(fs.readFileSync(file, 'utf8'), { configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'] });
  vm.runInNewContext(code, { exports, AbortController, ...globals, require: name => mocks[name] ?? {} }); return exports;
}
function find(tree, predicate) { if (!tree || typeof tree !== 'object') return undefined; if (!Array.isArray(tree) && predicate(tree)) return tree;
  for (const child of Array.isArray(tree) ? tree : tree.children ?? []) { const match = find(child, predicate); if (match) return match; } }
function text(tree) { if (typeof tree === 'string') return tree; return (Array.isArray(tree) ? tree : tree?.children ?? []).map(text).join(''); }
const settle = () => new Promise(setImmediate);
function pending() { let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; }
function resultFixture(scheduleType = 'NORMAL') {
  const view = renderer(), request = pending(), calls = []; let back = 0;
  const search = options => { calls.push(options); return request.promise; };
  const exports = load('src/screens/home/custom-alarm/ScheduleAlarmAddScreen.js', {
    react: view.react, 'react-native': { View: 'View', Text: 'Text', ScrollView: 'ScrollView', Platform: { select: value => value.default }, StyleSheet: { create: value => value } },
    '../../../components/RouteSearchLoadingScreen': { RouteSearchLoadingScreen: 'Loading' },
    '../../../components/DelayedLoading': { DelayedLoading: 'DelayedLoading' },
    '../../../api/transit/routes': { searchTransitRoutes: search, searchFirstLastTransitRoutes: search },
    '../../../theme': { colors: {}, typography: {}, layout: {} },
  });
  const props = { scheduleType, initialOrigin: { address: 'origin', x: 127, y: 37 }, initialDestination: { address: 'destination', x: 128, y: 38 }, onBackPress: () => { back++; } };
  return { view, request, calls, back: () => back, render: () => view.render(exports.ScheduleRouteResultStep, props) };
}

test('alarm setup opens the map and route results without animating their screen position', () => {
  const view = renderer();
  const { ScheduleAlarmAddScreen } = load('src/screens/home/custom-alarm/ScheduleAlarmAddScreen.js', {
    react: view.react,
    'react-native': { Platform: { select: options => options.default }, StyleSheet: { create: styles => styles } },
    '../../../theme': { colors: {}, typography: {}, layout: {} },
    '../../../hooks/useAndroidBackPress': { useAndroidBackPress() {} },
    '../../../components/ScreenTransition': { ScreenTransition: 'Transition' },
    '../../../components/NaverMapView': { preloadNaverMap: async () => {} },
    '../../../utils/routeSetupPlaces': { getRouteSetupPlaces: () => ({ origin: null, destination: null }) },
  });
  const render = () => view.render(ScheduleAlarmAddScreen, { initialStep: 'routeSetup' });

  const setup = render();
  assert.equal(setup.type, 'Transition');
  assert.equal(setup.props.active, true);
  setup.children[0].props.onPlacePress('origin');

  const map = render();
  assert.equal(map.props.transitionKey, 'route');
  assert.equal(map.props.active, false);
  map.children[0].props.onBackPress();
  render().children[0].props.onNextPress();

  const results = render();
  assert.equal(results.props.transitionKey, 'routeResult');
  assert.equal(results.props.active, false);
});

test('route result header edits origin/destination and returns to routeResult, and arrow swaps endpoints', async () => {
  const view = renderer();
  const { ScheduleAlarmAddScreen } = load('src/screens/home/custom-alarm/ScheduleAlarmAddScreen.js', {
    react: view.react,
    'react-native': { Platform: { select: options => options.default }, StyleSheet: { create: styles => styles } },
    '../../../theme': { colors: {}, typography: {}, layout: {} },
    '../../../hooks/useAndroidBackPress': { useAndroidBackPress() {} },
    '../../../components/ScreenTransition': { ScreenTransition: 'Transition' },
    '../../../components/NaverMapView': { preloadNaverMap: async () => {} },
    '../../../utils/accessibility': { blurActiveElement() {} },
    '../../../utils/routeSetupPlaces': {
      getRouteSetupPlaces: () => ({
        origin: { label: '출발A', name: '출발A', address: '출발A', x: 126.9, y: 37.5 },
        destination: { label: '도착B', name: '도착B', address: '도착B', x: 127.1, y: 37.6 },
      }),
    },
    '../../AddressManagementScreen': { AddressManagementScreen: 'AddressManagementScreen' },
  });
  const render = () => view.render(ScheduleAlarmAddScreen, { initialStep: 'routeSetup' });

  // Navigate to routeResult
  render().children[0].props.onNextPress();
  let results = render();
  assert.equal(results.props.transitionKey, 'routeResult');

  // 1) Tap origin -> opens map for origin -> selecting new origin returns to routeResult
  results.children[0].props.onEditPlacePress('origin');
  let map = render();
  assert.equal(map.props.transitionKey, 'route');
  assert.equal(map.children[0].props.activePlaceType, 'origin');
  map.children[0].props.onPlaceSelect('origin', { label: '새출발', name: '새출발', address: '새출발', x: 126.8, y: 37.4 });
  results = render();
  assert.equal(results.props.transitionKey, 'routeResult');
  assert.equal(results.children[0].props.initialOrigin.label, '새출발');
  assert.equal(results.children[0].props.initialDestination.label, '도착B');

  // 2) Tap destination -> opens map -> addressList -> selecting address returns to routeResult
  results.children[0].props.onEditPlacePress('destination');
  map = render();
  assert.equal(map.props.transitionKey, 'route');
  assert.equal(map.children[0].props.activePlaceType, 'destination');
  map.children[0].props.onAddressListPress();
  const addressList = render();
  assert.equal(addressList.props.transitionKey, 'addressList');
  addressList.children[0].props.onAddressSelect({ name: '새도착', address: '새도착 주소', x: 127.2, y: 37.7 });
  results = render();
  assert.equal(results.props.transitionKey, 'routeResult');
  assert.equal(results.children[0].props.initialOrigin.label, '새출발');
  assert.equal(results.children[0].props.initialDestination.label, '새도착');

  // 3) Back from map opened via routeResult returns to routeResult
  results.children[0].props.onEditPlacePress('origin');
  map = render();
  map.children[0].props.onBackPress();
  results = render();
  assert.equal(results.props.transitionKey, 'routeResult');

  // 4) Swapping updates parent routePlaces
  results.children[0].props.onSwapPlaces({
    origin: results.children[0].props.initialDestination,
    destination: results.children[0].props.initialOrigin,
  });
  results = render();
  assert.equal(results.children[0].props.initialOrigin.label, '새도착');
  assert.equal(results.children[0].props.initialDestination.label, '새출발');
});

test('ScheduleRouteResultStep pill buttons trigger origin edit, swap with re-search, and destination edit', async () => {
  const view = renderer();
  const calls = [];
  const editedTypes = [];
  const swapped = [];
  const exports = load('src/screens/home/custom-alarm/ScheduleAlarmAddScreen.js', {
    react: view.react,
    'react-native': {
      View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', Modal: 'Modal',
      Platform: { select: value => value.default }, StyleSheet: { create: value => value },
    },
    '../../../components/RouteSearchLoadingScreen': { RouteSearchLoadingScreen: 'Loading' },
    '../../../components/DelayedLoading': { DelayedLoading: 'DelayedLoading' },
    '../../../api/transit/routes': {
      searchTransitRoutes: async options => { calls.push(options); return []; },
      searchFirstLastTransitRoutes: async options => { calls.push(options); return []; },
    },
    '../../../theme': { colors: {}, typography: {}, layout: {} },
  });
  const props = {
    scheduleType: 'NORMAL',
    initialOrigin: { label: '출발지A', address: '출발지A', x: 126.9, y: 37.5 },
    initialDestination: { label: '목적지B', address: '목적지B', x: 127.1, y: 37.6 },
    onEditPlacePress: type => editedTypes.push(type),
    onSwapPlaces: places => swapped.push(places),
  };
  const render = () => view.render(exports.ScheduleRouteResultStep, props);
  render();
  view.flush();
  await settle();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].originX, 126.9);
  assert.equal(calls[0].destX, 127.1);

  const tree = render();
  find(tree, node => node.props?.accessibilityLabel === '출발지 변경').props.onPress();
  find(tree, node => node.props?.accessibilityLabel === '목적지 변경').props.onPress();
  assert.deepEqual(editedTypes, ['origin', 'destination']);

  find(tree, node => node.props?.accessibilityLabel === '출발지와 목적지 바꾸기').props.onPress();
  assert.equal(swapped.length, 1);
  assert.equal(swapped[0].origin.label, '목적지B');
  assert.equal(swapped[0].destination.label, '출발지A');

  render();
  view.flush();
  await settle();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].originX, 127.1);
  assert.equal(calls[1].destX, 126.9);
  view.unmount();
});

for (const type of ['NORMAL', 'FIRST_TRANSIT', 'LAST_TRANSIT']) {
  test(type + ' shows search status immediately and can cancel before animation starts', async () => {
    const f = resultFixture(type); const initial = f.render();
    assert.equal(initial.type, 'DelayedLoading');
    assert.equal(initial.props.fallback.type, 'Loading');
    assert.equal(initial.props.fallback.props.animateDots, false); f.view.flush();
    assert.equal(f.calls[0].scheduleType, type);
    initial.props.fallback.props.onFindAnotherRoute(); assert.equal(f.calls[0].signal.aborted, true); assert.equal(f.back(), 1);
    f.request.resolve([{ routeId: 'late', totalDurationMinutes: 10 }]); await settle();
    assert.equal(f.render().type, 'DelayedLoading'); f.view.unmount();
  });
}

function delayedFixture() {
  const view = renderer(), timers = new Map(); let now = 0, id = 0;
  const { DelayedLoading } = load('src/components/DelayedLoading.js', { react: view.react }, {
    setTimeout(callback, delay) { timers.set(++id, { callback, at: now + delay }); return id; },
    clearTimeout(timer) { timers.delete(timer); },
  });
  return {
    render: () => view.render(DelayedLoading, { children: 'loading', fallback: 'content' }),
    flush: view.flush, unmount: view.unmount, pending: () => timers.size,
    advance(ms) { now += ms; for (const [key, timer] of timers) if (timer.at <= now) { timers.delete(key); timer.callback(); } },
  };
}

test('loading remains hidden through 999ms and appears only at one second', () => {
  const f = delayedFixture(); assert.equal(f.render(), 'content'); f.flush();
  f.advance(999); assert.equal(f.render(), 'content');
  f.advance(1); assert.equal(f.render(), 'loading'); f.unmount();
});

test('finishing or leaving before one second cancels the pending loading display', () => {
  const f = delayedFixture(); f.render(); f.flush(); f.advance(400);
  assert.equal(f.render(), 'content'); f.unmount(); assert.equal(f.pending(), 0);
  f.advance(2000); assert.equal(f.render(), 'content');
});

test('a subsequent request starts with a fresh one-second loading delay', () => {
  const first = delayedFixture(); first.render(); first.flush(); first.advance(1000);
  assert.equal(first.render(), 'loading'); first.unmount();
  const next = delayedFixture(); assert.equal(next.render(), 'content'); next.flush();
  next.advance(999); assert.equal(next.render(), 'content'); next.unmount();
});

test('loading ends on success or error and leaving the screen aborts the request', async () => {
  const success = resultFixture(); success.render(); success.view.flush(); success.request.resolve([]); await settle();
  assert.equal(success.render().type, 'View'); success.view.unmount(); assert.equal(success.calls[0].signal.aborted, true);
  const failure = resultFixture(); failure.render(); failure.view.flush(); failure.request.reject(new Error('timeout')); await settle();
  assert.ok(text(failure.render()).includes('timeout')); failure.view.unmount();
});

function dotsFixture(reduced = false) {
  const view = renderer(); let change; const loops = [];
  class Value { constructor(value) { this.value = value; } setValue(value) { this.value = value; } interpolate(config) { return config; } }
  const Animated = { Value, View: 'Dot', delay: duration => ({ duration }), timing: (_, config) => config,
    sequence: steps => steps, parallel: sequences => sequences,
    loop: sequences => { const loop = { sequences, start() { this.started = true; }, stop() { this.stopped = true; } }; loops.push(loop); return loop; } };
  const api = load('src/components/RouteSearchLoadingScreen.js', {
    react: view.react, '../theme': { colors: {} },
    'react-native': { Animated, Easing: { sin: 'sin', inOut: value => value }, View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: value => value },
      AccessibilityInfo: { isReduceMotionEnabled: async () => reduced, addEventListener(_, fn) { change = fn; return { remove() {} }; } } },
  });
  return { view, loops, change: value => change(value), render: props => view.render(api.RouteSearchLoadingScreen, props) };
}

test('three typing dots bob sequentially using the native driver, and reduced motion stops them', async () => {
  const f = dotsFixture(); const initial = f.render({ animateDots: false }); f.view.flush(); await settle();
  assert.ok(text(initial).includes('이동 경로를 찾고 있어요'));
  assert.equal(f.loops.length, 0);
  const tree = f.render({ animateDots: true }); f.view.flush(); await settle();
  const dots = find(tree, node => node.props.accessibilityRole === 'progressbar').children[0];
  assert.equal(dots.length, 3); assert.equal(f.loops[0].started, true);
  assert.deepEqual(Array.from(f.loops[0].sequences, sequence => sequence[0].duration), [0, 140, 280]);
  for (const sequence of f.loops[0].sequences) assert.equal(sequence[1].useNativeDriver, true);
  f.change(true); assert.equal(f.loops[0].stopped, true); f.view.unmount();
  const reduced = dotsFixture(true); reduced.render({}); reduced.view.flush(); await settle(); assert.equal(reduced.loops.length, 0); reduced.view.unmount();
});
