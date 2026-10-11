const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const { test } = require('node:test');

function fixture(file, mocks = {}, globals = {}) {
  const slots = [], effects = [];
  let cursor = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    memo: component => component, useCallback: fn => fn, useMemo: fn => fn(),
    useRef: initial => slots[cursor++] ??= { current: initial },
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
  const native = {
    View: 'View', Text: 'Text', Modal: 'Modal', Alert: { alert() {} },
    Platform: { OS: 'web', select: options => options.web ?? options.default },
    StyleSheet: { create: value => value, absoluteFillObject: { top: 0, bottom: 0, left: 0, right: 0 } },
    Animated: {
      Value: class { interpolate(value) { return value; } }, View: 'AnimatedView',
      timing: () => ({}), loop: () => ({ start() {}, stop() {} }),
    },
  };
  const exports = {};
  const { code } = babel.transformSync(fs.readFileSync(file, 'utf8'), {
    configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'],
  });
  vm.runInNewContext(code, { exports, AbortController, console, ...globals, require: name =>
    name === 'react' ? react : name === 'react-native' ? native :
    name.endsWith('/theme') ? { colors: {}, typography: {}, layout: {} } :
    name.endsWith('/DeletionProgressModal') ? { DeletionProgressModal: 'DeletionProgressModal' } :
    name.endsWith('/accessibility') ? { blurActiveElement() {} } : mocks[name] ?? {} });
  const Component = Object.values(exports).find(value => typeof value === 'function');
  return { render(props = {}) { cursor = 0; return Component(props); },
    flush() { effects.splice(0).forEach(fn => fn()); },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); } };
}
function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return undefined;
  if (!Array.isArray(tree) && predicate(tree)) return tree;
  for (const child of Array.isArray(tree) ? tree : tree.children ?? []) {
    const result = find(child, predicate); if (result) return result;
  }
}
function text(tree) {
  if (typeof tree === 'string') return tree;
  return (Array.isArray(tree) ? tree : tree?.children ?? []).map(text).join('');
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

test('deletion dots cycle . .. ... . and stop on close/unmount', () => {
  let tick, cleared = 0;
  const f = fixture('src/components/DeletionProgressModal.js', {}, {
    setInterval(fn, delay) { tick = fn; assert.equal(delay, 500); return 1; },
    clearInterval() { cleared++; },
  });
  assert.ok(text(f.render({ visible: true })).endsWith(' .')); f.flush();
  for (const suffix of [' ..', ' ...', ' .']) {
    tick(); assert.ok(text(f.render({ visible: true })).endsWith(suffix));
  }
  assert.equal(text(f.render({ visible: false })), ''); f.flush();
  assert.equal(cleared, 1);
  assert.ok(text(f.render({ visible: true })).endsWith(' .')); f.flush(); f.unmount();
  assert.equal(cleared, 2);
});

for (const kind of ['garage', 'schedule']) {
  test(kind + ' deletion stays visible until response and prevents duplicate requests', async () => {
    const request = deferred(); let calls = 0;
    const deletion = () => { calls++; return request.promise; };
    const f = fixture('src/screens/home/custom-alarm/CustomAlarmScreen.js', {
      '../../../api/homeCache': {
        homeCacheKeys: { depotNotifications: 'depot', scheduleNotifications: 'schedule' },
        readHomeCache: key => key === 'depot' ? [{ userBusId: 1 }] : [{ notificationId: 2 }],
      },
      '../../../api/notifications/depot': { deleteDepotNotification: deletion },
      '../../../api/notifications/arrival': { deleteArrivalNotifications: deletion },
    });
    const initial = f.render();
    const card = find(initial, node => node.props.alarm &&
      (kind === 'garage' ? node.props.alarm.userBusId : node.props.alarm.notificationId));
    card.props.onDeletePress();
    const confirm = find(f.render(), node => node.props.onConfirm && 'deleting' in node.props);
    const pending = confirm.props.onConfirm();
    await confirm.props.onConfirm(); assert.equal(calls, 1);
    assert.equal(find(f.render(), node => node.type === 'DeletionProgressModal').props.visible, true);
    request.resolve(); await pending;
    assert.equal(find(f.render(), node => node.type === 'DeletionProgressModal').props.visible, false);
  });
}

test('map loading uses plain login-style text with a 7px gap instead of covering the map', () => {
  const f = fixture('src/components/MapLoadingOverlay.js');
  const overlay = f.render();
  assert.equal(overlay.props.pointerEvents, 'none');
  assert.equal(overlay.type, 'Text');
  assert.equal(overlay.props.style.marginBottom, 7);
  assert.equal(overlay.props.style.lineHeight, 19.2);
  assert.equal(overlay.props.style.backgroundColor, undefined);
  assert.equal(overlay.props.style.position, undefined);
  assert.equal(overlay.props.style.top, undefined);
  assert.equal(overlay.props.style.left, undefined);
  assert.equal(overlay.props.style.right, undefined);
});


for (const fail of [false, true]) {
  test('first-last deletion closes progress after ' + (fail ? 'failure' : 'success'), async () => {
    const request = deferred(); let calls = 0;
    const cache = new Map([
      ['first', { cacheVersion: 2, scheduleType: 'FIRST', notificationId: 1 }],
      ['last', { cacheVersion: 2, scheduleType: 'LAST', notificationId: 2 }],
    ]);
    const f = fixture('src/screens/HomeScreen.js', {
      '../utils/firstLastDisplay': { getPreferredTransitType: () => 'FIRST' },
      '../api/notifications/transit': {
        TRANSIT_SCHEDULE_TYPES: { first: 'FIRST', last: 'LAST' },
        deleteTransitNotification: () => { calls++; return request.promise; },
      },
      '../api/homeCache': {
        homeCacheKeys: { firstTransitRoute: 'first', lastTransitRoute: 'last' },
        readHomeCache: key => cache.get(key), removeHomeCache: key => cache.delete(key),
      },
    });
    const dashboard = find(f.render(), node => node.props.onRouteDeletePress);
    const pending = dashboard.props.onRouteDeletePress();
    await dashboard.props.onRouteDeletePress();
    assert.equal(calls, 1);
    assert.equal(find(f.render(), node => node.type === 'DeletionProgressModal').props.visible, true);
    if (fail) request.reject(new Error('offline')); else request.resolve();
    await pending;
    const tree = f.render();
    assert.equal(find(tree, node => node.type === 'DeletionProgressModal').props.visible, false);
    assert.equal(Boolean(find(tree, node => node.props.onRouteDeletePress).props.firstLastRouteSummary), fail);
    assert.ok(cache.has('last'));
  });
}
