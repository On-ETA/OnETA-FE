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

for (const type of ['NORMAL', 'FIRST_TRANSIT', 'LAST_TRANSIT']) {
  test(type + ' delays loading and cancels before returning to place setup', async () => {
    const f = resultFixture(type); const initial = f.render();
    assert.equal(initial.type, 'DelayedLoading');
    assert.equal(initial.props.fallback.type, 'View'); f.view.flush();
    assert.equal(f.calls[0].scheduleType, type);
    find(f.render(), node => node.type === 'Loading').props.onFindAnotherRoute(); assert.equal(f.calls[0].signal.aborted, true); assert.equal(f.back(), 1);
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
  const f = dotsFixture(); const tree = f.render({}); f.view.flush(); await settle();
  const dots = find(tree, node => node.props.accessibilityRole === 'progressbar').children[0];
  assert.equal(dots.length, 3); assert.equal(f.loops[0].started, true);
  assert.deepEqual(Array.from(f.loops[0].sequences, sequence => sequence[0].duration), [0, 140, 280]);
  for (const sequence of f.loops[0].sequences) assert.equal(sequence[1].useNativeDriver, true);
  f.change(true); assert.equal(f.loops[0].stopped, true); f.view.unmount();
  const reduced = dotsFixture(true); reduced.render({}); reduced.view.flush(); await settle(); assert.equal(reduced.loops.length, 0); reduced.view.unmount();
});
