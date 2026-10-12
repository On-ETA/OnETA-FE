const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const { test } = require('node:test');
function environment() {
  let active;
  const handlers = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }), memo: component => component,
    useMemo: fn => fn(), useCallback: fn => fn,
    useRef(initial) { const index = active.cursor++; return active.slots[index] ??= { current: initial }; },
    useState(initial) {
      const instance = active, index = instance.cursor++;
      if (!(index in instance.slots)) instance.slots[index] = typeof initial === 'function' ? initial() : initial;
      return [instance.slots[index], value => { instance.slots[index] = typeof value === 'function' ? value(instance.slots[index]) : value; }];
    },
    useEffect(fn, deps) {
      const instance = active, index = instance.cursor++, prior = instance.slots[index];
      if (!prior || deps.some((value, i) => !Object.is(value, prior.deps[i]))) {
        instance.slots[index] = { deps, cleanup: prior?.cleanup };
        instance.effects.push(() => { instance.slots[index].cleanup?.(); instance.slots[index].cleanup = fn(); });
      }
    },
  };
  const BackHandler = { addEventListener(_, fn) {
    handlers.push(fn); return { remove() { const index = handlers.indexOf(fn); if (index >= 0) handlers.splice(index, 1); } };
  } };
  const native = { BackHandler, Platform: { OS: 'android', select: options => options.android ?? options.default },
    StyleSheet: { create: value => value }, AppState: { currentState: 'active' } };
  function load(file, mocks = {}) {
    const exports = {};
    const { code } = babel.transformSync(fs.readFileSync(file, 'utf8'), { configFile: false, babelrc: false,
      plugins: ['@babel/plugin-transform-modules-commonjs', '@babel/plugin-transform-react-jsx'] });
    vm.runInNewContext(code, { exports, AbortController, console, require: name =>
      name === 'react' ? react : name === 'react-native' ? native :
      name.endsWith('/theme') ? { colors: {}, typography: {}, layout: {} } :
      name.endsWith('/accessibility') ? { blurActiveElement() {} } : mocks[name] ?? {} });
    return exports;
  }
  const backHook = load('src/hooks/useAndroidBackPress.js');
  function mount(Component, initialProps = {}) {
    const instance = { cursor: 0, slots: [], effects: [] };
    let props = initialProps;
    return {
      render(next = {}) { props = { ...props, ...next }; active = instance; instance.cursor = 0; return Component(props); },
      flush() { instance.effects.splice(0).forEach(fn => fn()); },
      unmount() { instance.slots.forEach(slot => slot?.cleanup?.()); },
    };
  }
  return { load, mount, backHook, handlers, BackHandler, press() {
    for (const handler of [...handlers].reverse()) if (handler()) return true;
    return false;
  } };
}
function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return undefined;
  if (!Array.isArray(tree) && predicate(tree)) return tree;
  for (const child of Array.isArray(tree) ? tree : tree.children ?? []) {
    const match = find(child, predicate); if (match) return match;
  }
}

test('Android back from map -> address list returns to the map, then the route setup, and removes handlers on unmount', () => {
  const e = environment(); let exits = 0;
  const { ScheduleAlarmAddScreen } = e.load('src/screens/home/custom-alarm/ScheduleAlarmAddScreen.js', {
    '../../../hooks/useAndroidBackPress': e.backHook,
    '../../../utils/routeSetupPlaces': { getRouteSetupPlaces: () => ({ origin: null, destination: null }) },
    '../../AddressManagementScreen': { AddressManagementScreen: 'AddressManagementScreen' },
  });
  const parent = e.mount(ScheduleAlarmAddScreen, { initialStep: 'route', onBackPress: () => { exits++; } });
  const map = find(parent.render(), node => node.props.onAddressListPress); parent.flush();
  map.props.onAddressListPress();
  const list = find(parent.render(), node => node.type === 'AddressManagementScreen'); parent.flush();
  const { AddressManagementScreen } = e.load('src/screens/AddressManagementScreen.js', {
    '../hooks/useAndroidBackPress': e.backHook, '../api/addresses': { getAddresses: async () => [] },
  });
  const child = e.mount(AddressManagementScreen, list.props); child.render(); child.flush();
  // A parent can register later than its child: it must still delegate to the child.
  let homeCalls = 0;
  const home = e.BackHandler.addEventListener('hardwareBackPress', () => { homeCalls++; return false; });
  assert.equal(e.press(), true);
  assert.equal(exits, 0); assert.equal(homeCalls, 1);
  child.unmount();
  assert.ok(find(parent.render(), node => node.props.onAddressListPress)); parent.flush();
  assert.equal(e.press(), true); assert.equal(exits, 1);
  home.remove(); parent.unmount(); assert.equal(e.handlers.length, 0);
});

test('address search/detail consumes Android back one step at a time before returning to the parent', () => {
  const e = environment(); let exits = 0;
  const { AddressManagementScreen } = e.load('src/screens/AddressManagementScreen.js', {
    '../hooks/useAndroidBackPress': e.backHook, '../api/addresses': { getAddresses: async () => [] },
  });
  const f = e.mount(AddressManagementScreen, { onBackPress: () => { exits++; } });
  const initial = f.render(); f.flush();
  find(initial, node => node.props.accessibilityLabel === '\uC8FC\uC18C \uCD94\uAC00').props.onPress();
  const search = find(f.render(), node => node.props.onResultPress); f.flush();
  search.props.onResultPress({ name: 'address', address: 'address', x: 127, y: 37 });
  f.render(); f.flush(); e.press();
  assert.ok(find(f.render(), node => node.props.onResultPress)); f.flush();
  e.press(); f.render(); f.flush(); assert.equal(exits, 0);
  e.press(); assert.equal(exits, 1);
  f.unmount(); assert.equal(e.handlers.length, 0);
});

test('an unfocused inner screen does not intercept back on another route', () => {
  const e = environment(); let calls = 0;
  const Component = ({ enabled }) => { e.backHook.useAndroidBackPress(() => { calls++; return true; }, enabled); return null; };
  const f = e.mount(Component, { enabled: true }); f.render(); f.flush(); assert.equal(e.press(), true);
  f.render({ enabled: false }); f.flush(); assert.equal(e.press(), false); assert.equal(calls, 1);
});

test('Home delegates Android back while an alarm setup owns its internal history', () => {
  const e = environment();
  const { HomeScreen } = e.load('src/screens/HomeScreen.js', {
    '../utils/firstLastDisplay': { getPreferredTransitType: () => 'FIRST', startFirstLastClock: () => () => {} },
    '../api/notifications/transit': { TRANSIT_SCHEDULE_TYPES: { first: 'FIRST', last: 'LAST' } },
    '../api/homeCache': { homeCacheKeys: {}, readHomeCache: () => null },
    '../api/addresses': { getAddresses: async () => [] },
    '../notifications/events': { subscribeNotifications: () => () => {} },
    '../utils/transitRefresh': { startTransitRefresh: () => () => {} },
    '../components/reverseGeocode': { getCurrentCoordinate: async () => ({ latitude: 37, longitude: 127 }) },
    './home/custom-alarm/ScheduleAlarmAddScreen': { ScheduleAlarmAddScreen: 'ScheduleAlarmAddScreen' },
  });
  const f = e.mount(HomeScreen); const tree = f.render(); f.flush();
  find(tree, node => node.props.onScheduleAlarmAddPress).props.onScheduleAlarmAddPress();
  assert.ok(find(f.render(), node => node.type === 'ScheduleAlarmAddScreen')); f.flush();
  assert.equal(e.press(), false);
  assert.ok(find(f.render(), node => node.type === 'ScheduleAlarmAddScreen'));
  f.unmount();
});
