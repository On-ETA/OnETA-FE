const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const babel = require('@babel/core');

function renderer() {
  const slots = [];
  const effects = [];
  let cursor = 0;
  let firstRender = true;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useMemo: callback => callback(),
    useEffect: callback => { if (firstRender) effects.push(callback); },
  };
  return {
    react,
    render(component, props) {
      cursor = 0;
      const tree = component(props);
      firstRender = false;
      return tree;
    },
    flushEffects: () => effects.splice(0).forEach(callback => callback()),
  };
}

function load(file, mocks, globals = {}) {
  const exports = {};
  const { code } = babel.transformSync(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs', '@babel/plugin-transform-react-jsx'],
  });
  vm.runInNewContext(code, { exports, setTimeout, clearTimeout, require: name => mocks[name] ?? {}, ...globals });
  return exports;
}

function locationFixture(props = {}, cachedCoordinate = null, lookup) {
  const view = renderer();
  let resolveLocation;
  let rejectLocation;
  const location = new Promise((resolve, reject) => { resolveLocation = resolve; rejectLocation = reject; });
  const timers = [];
  const api = load('src/screens/home/custom-alarm/ScheduleAlarmAddScreen.js', {
    react: view.react,
    'react-native': {
      View: 'View', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable', ScrollView: 'ScrollView',
      Animated: { Value: class {}, View: 'AnimatedView' },
      PanResponder: { create: () => ({ panHandlers: {} }) },
      Platform: { OS: 'android', select: options => options.android ?? options.default },
      StyleSheet: { create: value => value }, useWindowDimensions: () => ({ height: 800 }),
    },
    '../../../components/NaverMapView': { NaverMapView: 'NaverMapView' },
    '../../../components/MapLoadingOverlay': { MapLoadingOverlay: 'MapLoadingOverlay' },
    '../../../config/naverMap': { NAVER_MAP_DEFAULT_CENTER: { latitude: 37.5563, longitude: 126.922 } },
    '../../../utils/locationError': load('src/utils/locationError.js', {}),
    '../../../components/reverseGeocode': { getCurrentCoordinate: lookup ?? (() => location), getCachedCurrentCoordinate: () => cachedCoordinate },
    '../../../theme': { colors: {}, typography: {}, layout: {} },
  }, {
    setTimeout: (callback, delay) => { const timer = { callback, delay }; timers.push(timer); return timer; },
    clearTimeout: timer => { if (timer) timer.cancelled = true; },
  });
  return { view, resolveLocation, rejectLocation, timers, render: () => view.render(api.ScheduleRouteMapStep, props) };
}

function find(tree, type) {
  if (!tree || typeof tree !== 'object') return undefined;
  if (tree.type === type) return tree;
  for (const child of (Array.isArray(tree) ? tree : tree.children ?? [])) {
    const match = find(child, type);
    if (match) return match;
  }
}

function textContent(tree) {
  if (typeof tree === 'string') return tree;
  if (!tree || typeof tree !== 'object') return '';
  return (Array.isArray(tree) ? tree : tree.children ?? []).map(textContent).join('');
}

test('map renders before location resolves, then moves to the current location', async () => {
  const f = locationFixture();
  assert.ok(find(f.render(), 'NaverMapView'));
  f.view.flushEffects();
  assert.ok(find(f.render(), 'NaverMapView'));
  f.resolveLocation({ latitude: 37.5, longitude: 127.1 });
  await new Promise(setImmediate);
  assert.equal(find(f.render(), 'NaverMapView').props.center.latitude, 37.5);
});

test('map starts at coordinates already resolved before opening it', () => {
  const f = locationFixture({}, { latitude: 37.8, longitude: 127.2 });
  assert.equal(find(f.render(), 'NaverMapView').props.center.latitude, 37.8);
});

test('map loading and location loading are displayed separately', () => {
  const f = locationFixture({ selectionMode: true });
  const initial = f.render();
  assert.ok(find(initial, 'MapLoadingOverlay'));
  assert.ok(!textContent(initial).includes('현 위치를 불러오는 중'));
  find(initial, 'NaverMapView').props.onReady();
  const ready = f.render();
  assert.equal(find(ready, 'MapLoadingOverlay'), undefined);
  assert.ok(textContent(ready).includes('현 위치를 불러오는 중주소 목록에서 불러오기'));
});

test('searching before the map initializes prevents a late location result from changing its center', async () => {
  const f = locationFixture({ selectionMode: true });
  const tree = f.render();
  f.view.flushEffects();
  find(tree, 'TextInput').props.onChangeText('강남역');
  f.resolveLocation({ latitude: 38, longitude: 128 });
  await new Promise(setImmediate);
  const searched = f.render();
  assert.equal(find(searched, 'NaverMapView').props.center.latitude, 37.5563);
  assert.equal(find(searched, 'TextInput').props.value, '강남역');
});

test('placing a pin prevents a late location result from moving the map or replacing the pin', async () => {
  const f = locationFixture({ selectionMode: true });
  const tree = f.render();
  f.view.flushEffects();
  await find(tree, 'NaverMapView').props.onMapPress({ latitude: 37.7, longitude: 126.8 });
  f.resolveLocation({ latitude: 38, longitude: 128 });
  await new Promise(setImmediate);
  const pinned = find(f.render(), 'NaverMapView');
  assert.equal(pinned.props.center.latitude, 37.5563);
  assert.equal(pinned.props.markers[0].latitude, 37.7);
});

test('failed location displays its reason and repeatedly retries until success without interaction', async () => {
  let calls = 0;
  const f = locationFixture({ selectionMode: true }, null, async () => {
    if (++calls < 3) throw Object.assign(new Error('timeout'), { code: 'LOCATION_TIMEOUT' });
    return { latitude: 37.8, longitude: 127.2 };
  });
  const tree = f.render();
  find(tree, 'NaverMapView').props.onReady();
  f.view.flushEffects();
  await new Promise(setImmediate);
  assert.ok(textContent(f.render()).includes('위치 조회 실패: 위치 조회 시간이 초과되었습니다.'));
  assert.equal(f.timers[0].delay, 5000);
  await f.timers[0].callback();
  assert.equal(f.timers[1].delay, 5000);
  await f.timers[1].callback();
  assert.equal(calls, 3);
  assert.ok(!textContent(f.render()).includes('위치 조회 실패'));
  assert.equal(find(f.render(), 'NaverMapView').props.center.latitude, 37.8);
});

test('searching cancels a scheduled retry and a late failure does not schedule another', async () => {
  const f = locationFixture({ selectionMode: true });
  const tree = f.render();
  f.view.flushEffects();
  find(tree, 'TextInput').props.onChangeText('강남역');
  f.rejectLocation(Object.assign(new Error('denied'), { code: 1 }));
  await new Promise(setImmediate);
  assert.equal(f.timers.length, 0);

  const failed = locationFixture({ selectionMode: true });
  const failedTree = failed.render();
  failed.view.flushEffects();
  failed.rejectLocation(new Error('unavailable'));
  await new Promise(setImmediate);
  find(failedTree, 'TextInput').props.onChangeText('강남역');
  assert.equal(failed.timers[0].cancelled, true);
});

test('a late location result does not replace saved place coordinates', async () => {
  const f = locationFixture({ initialOrigin: { name: 'saved', x: 126.9, y: 37.6 } });
  assert.equal(find(f.render(), 'NaverMapView').props.center.latitude, 37.6);
  f.view.flushEffects();
  f.resolveLocation({ latitude: 37.5, longitude: 127.1 });
  await new Promise(setImmediate);
  assert.equal(find(f.render(), 'NaverMapView').props.center.latitude, 37.6);
});

test('interacting with the map prevents a late location result from moving it', async () => {
  const f = locationFixture();
  const tree = f.render();
  f.view.flushEffects();
  tree.children[0].props.onStartShouldSetResponderCapture();
  find(tree, 'NaverMapView').props.onCameraIdle({ latitude: 37.7, longitude: 126.8, zoom: 15 });
  f.resolveLocation({ latitude: 37.5, longitude: 127.1 });
  await new Promise(setImmediate);
  assert.equal(find(f.render(), 'NaverMapView').props.center.latitude, 37.7);
});

test('web SDK preload is shared and initializes the map with the latest coordinates', async () => {
  const view = renderer();
  const scripts = [];
  const centers = [];
  const listeners = {};
  let readyCount = 0;
  const naver = {};
  const api = load('src/components/NaverMapView.js', {
    react: view.react,
    'react-native': { Platform: { OS: 'web' }, View: 'View', StyleSheet: { create: value => value } },
    '../config/naverMap': { NAVER_MAP_CLIENT_ID: 'test', NAVER_MAP_DEFAULT_CENTER: { latitude: 37, longitude: 127 } },
    '../theme': { colors: {}, typography: {} },
  }, {
    naver,
    document: { createElement: () => ({}), head: { appendChild: script => scripts.push(script) }, getElementById: () => ({}) },
  });
  const first = api.preloadNaverMap();
  assert.equal(first, api.preloadNaverMap());
  const wrapper = api.NaverMapView({ center: { latitude: 37, longitude: 127 }, showCenterMarker: false, onReady: () => readyCount++ });
  view.render(wrapper.type, wrapper.props);
  view.flushEffects();
  view.render(wrapper.type, { ...wrapper.props, center: { latitude: 37.5, longitude: 127.1 } });
  naver.maps = {
    LatLng: class { constructor(latitude, longitude) { this.latitude = latitude; this.longitude = longitude; } },
    Map: class { constructor(element, options) { centers.push(options.center); } },
    Event: { addListener: (_, event, callback) => { listeners[event] = callback; return {}; } },
  };
  scripts[0].onload();
  await first;
  await new Promise(setImmediate);
  assert.equal(scripts.length, 1);
  assert.equal(centers[0].latitude, 37.5);
  assert.equal(readyCount, 0);
  listeners.tilesloaded();
  assert.equal(readyCount, 1);
  listeners.tilesloaded();
  assert.equal(readyCount, 1);
});
