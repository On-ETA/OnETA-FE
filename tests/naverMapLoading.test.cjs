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
    useEffect(callback, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || !deps || deps.some((value, i) => !Object.is(value, previous.deps?.[i]))) {
        slots[index] = { deps, cleanup: previous?.cleanup };
        effects.push(() => {
          slots[index].cleanup?.();
          slots[index].cleanup = callback();
        });
      }
    },
  };
  return {
    react,
    render(component, props) {
      cursor = 0;
      const tree = component(props);

      return tree;
    },
    flushEffects: () => effects.splice(0).forEach(callback => callback()),
  };
}

function load(file, mocks, globals = {}, exposed = []) {
  const exports = {};
  const { code } = babel.transformSync(fs.readFileSync(path.join(__dirname, '..', file), 'utf8') + exposed.map(name => '\nexports.' + name + ' = ' + name + ';').join(''), {
    configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs', '@babel/plugin-transform-react-jsx'],
  });
  vm.runInNewContext(code, { exports, setTimeout, clearTimeout, AbortController, require: name => mocks[name] ?? {}, ...globals });
  return exports;
}

function locationFixture(props = {}, cachedCoordinate = null, lookup, extraMocks = {}) {
  const view = renderer();
  let resolveLocation;
  let rejectLocation;
  const location = new Promise((resolve, reject) => { resolveLocation = resolve; rejectLocation = reject; });
  const timers = [];
  const timerGlobals = {
    setTimeout: (callback, delay) => { const timer = { callback, delay }; timers.push(timer); return timer; },
    clearTimeout: timer => { if (timer) timer.cancelled = true; },
  };
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
    '../../../utils/throttledTask': load('src/utils/throttledTask.js', {}, timerGlobals),
    '../../../utils/searchKeyword': load('src/utils/searchKeyword.js', {}),
    '../../../components/reverseGeocode': { getCurrentCoordinate: lookup ?? (() => location), getCachedCurrentCoordinate: () => cachedCoordinate },
    '../../../theme': { colors: {}, typography: {}, layout: {} },
    ...extraMocks,
  }, timerGlobals);
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


test('continuous typing and deletion search once per second without resetting the timer; clearing cancels and map movement never searches', async () => {
  const calls = [];
  const f = locationFixture({}, { latitude: 37.5, longitude: 127 }, undefined, {
    '../../../api/address/search': { searchAddresses: async request => { calls.push(request); return []; } },
  });
  f.render(); f.view.flushEffects();
  const type = value => { find(f.render(), 'TextInput').props.onChangeText(value); f.render(); f.view.flushEffects(); };
  type('Seoul');
  const first = f.timers.findLast(timer => timer.delay === 1000);
  assert.ok(first); assert.equal(calls.length, 0);
  type('Seou');
  assert.notEqual(first.cancelled, true);
  const deletion = f.timers.findLast(timer => timer.delay === 1000);
  assert.equal(deletion, first);
  await deletion.callback();
  assert.equal(calls.length, 1); assert.equal(calls[0].keyword, 'Seou');
  const secondWindow = f.timers.findLast(timer => timer.delay === 1000);
  find(f.render(), 'NaverMapView').props.onCameraIdle({ latitude: 37.6, longitude: 127.2, zoom: 12 });
  f.render(); f.view.flushEffects();
  assert.equal(f.timers.findLast(timer => timer.delay === 1000), secondWindow);
  assert.equal(calls.length, 1);
  type('Seoul');
  type('Seoul Station');
  assert.equal(f.timers.findLast(timer => timer.delay === 1000), secondWindow);
  await secondWindow.callback();
  assert.equal(calls.length, 2); assert.equal(calls[1].keyword, 'Seoul Station');
  type('Seoul ');
  const pending = f.timers.findLast(timer => timer.delay === 1000);
  type('');
  assert.equal(pending.cancelled, true);
  await pending.callback();
  assert.equal(calls.length, 2);
});

test('placing a pin searches immediately after geocoding and cancels pending keyword and earlier pin requests', async () => {
  const calls = [];
  const f = locationFixture({}, { latitude: 37.5, longitude: 127 }, undefined, {
    '../../../api/address/search': { searchAddresses: async request => { calls.push(request); return []; } },
    '../../../components/reverseGeocode': {
      getCachedCurrentCoordinate: () => ({ latitude: 37.5, longitude: 127 }),
      reverseGeocode: async coordinate => ({ roadAddress: 'Pin address', ...coordinate }),
    },
  });
  f.render(); f.view.flushEffects();
  find(f.render(), 'TextInput').props.onChangeText('pending');
  f.render(); f.view.flushEffects();
  const pending = f.timers.findLast(timer => timer.delay === 1000);
  await find(f.render(), 'NaverMapView').props.onMapPress({ latitude: 37.6, longitude: 127.1 });
  assert.equal(calls.length, 1); assert.equal(calls[0].keyword, 'Pin address');
  await pending.callback(); assert.equal(calls.length, 1);
  await find(f.render(), 'NaverMapView').props.onMapPress({ latitude: 37.7, longitude: 127.2 });
  assert.equal(calls.length, 2); assert.equal(calls[0].signal.aborted, true);
  find(f.render(), 'TextInput').props.onChangeText('new keyword');
  assert.equal(calls[1].signal.aborted, true);
});


test('an older pin geocode cannot start a search after a newer pin was selected', async () => {
  const geocodes = [], calls = [];
  const f = locationFixture({}, { latitude: 37.5, longitude: 127 }, undefined, {
    '../../../api/address/search': { searchAddresses: async request => { calls.push(request); return []; } },
    '../../../components/reverseGeocode': {
      getCachedCurrentCoordinate: () => ({ latitude: 37.5, longitude: 127 }),
      reverseGeocode: coordinate => new Promise(resolve => geocodes.push({ coordinate, resolve })),
    },
  });
  f.render(); f.view.flushEffects();
  const older = find(f.render(), 'NaverMapView').props.onMapPress({ latitude: 37.6, longitude: 127.1 });
  const newer = find(f.render(), 'NaverMapView').props.onMapPress({ latitude: 37.7, longitude: 127.2 });
  geocodes[1].resolve({ roadAddress: 'New pin' }); await newer;
  geocodes[0].resolve({ roadAddress: 'Old pin' }); await older;
  assert.equal(calls.length, 1); assert.equal(calls[0].keyword, 'New pin');
});

test('web pin geocoding loads the map SDK and uses road addresses with a parcel address fallback', async () => {
  let preloads = 0, request, nextAddress = { roadAddress: 'Road address', jibunAddress: 'Parcel address' };
  const web = load('src/components/reverseGeocode.web.js', {
    '../utils/currentLocationRequest': { createCurrentLocationRequest: () => ({}) },
    './NaverMapView': { preloadNaverMap: async () => { preloads++; } },
  }, { naver: { maps: {
    LatLng: class { constructor(latitude, longitude) { this.latitude = latitude; this.longitude = longitude; } },
    Service: {
      Status: { OK: 'OK' }, OrderType: { ROAD_ADDR: 'roadaddr', ADDR: 'addr' },
      reverseGeocode: (options, callback) => { request = options; callback('OK', { v2: { address: nextAddress } }); },
    },
  } } });
  const road = await web.reverseGeocode({ latitude: 37.5, longitude: 127.1 });
  assert.equal(preloads, 1); assert.equal(road.roadAddress, 'Road address');
  assert.equal(request.coords.latitude, 37.5); assert.equal(request.orders, 'roadaddr,addr');
  nextAddress = { jibunAddress: 'Parcel address' };
  assert.equal((await web.reverseGeocode({ latitude: 37.5, longitude: 127.1 })).address, 'Parcel address');
  nextAddress = {};
  await assert.rejects(web.reverseGeocode({ latitude: 37.5, longitude: 127.1 }));
  const beforeInvalid = preloads;
  await assert.rejects(web.reverseGeocode({ latitude: NaN, longitude: 127.1 }));
  assert.equal(preloads, beforeInvalid);
});


test('map keyword search postpones unfinished Korean at each tick and pin selection cancels that waiting search', async () => {
  const calls = [];
  const f = locationFixture({}, { latitude: 37.5, longitude: 127 }, undefined, {
    '../../../api/address/search': { searchAddresses: async request => { calls.push(request); return []; } },
    '../../../components/reverseGeocode': {
      getCachedCurrentCoordinate: () => ({ latitude: 37.5, longitude: 127 }),
      reverseGeocode: async () => ({ roadAddress: '\uc11c\uc6b8' }),
    },
  });
  f.render(); f.view.flushEffects();
  const type = value => { find(f.render(), 'TextInput').props.onChangeText(value); f.render(); f.view.flushEffects(); };
  const tick = () => f.timers.findLast(timer => timer.delay === 1000);
  type('\u3131'); await tick().callback(); assert.equal(calls.length, 0);
  const waiting = tick(); type('\u3131\u314f'); assert.equal(tick(), waiting);
  await waiting.callback(); assert.equal(calls.length, 0);
  type('\uac00'); await tick().callback(); assert.equal(calls.length, 1); assert.equal(calls[0].keyword, '\uac00');
  type('\u3134'); await tick().callback(); assert.equal(calls.length, 1);
  const deferred = tick();
  await find(f.render(), 'NaverMapView').props.onMapPress({ latitude: 37.6, longitude: 127.1 });
  assert.equal(calls.length, 2); assert.equal(calls[1].keyword, '\uc11c\uc6b8');
  assert.equal(deferred.cancelled, true); await deferred.callback(); assert.equal(calls.length, 2);
});


test('address management defers incomplete Korean before calling the search API', async () => {
  const view = renderer(), timers = [], calls = [];
  const timerGlobals = {
    setTimeout: (callback, delay) => { const timer = { callback, delay }; timers.push(timer); return timer; },
    clearTimeout: timer => { if (timer) timer.cancelled = true; },
  };
  const api = load('src/screens/AddressManagementScreen.js', {
    react: view.react,
    'react-native': {
      View: 'View', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable', ScrollView: 'ScrollView',
      StyleSheet: { create: value => value }, Platform: { OS: 'web', select: value => value.web ?? value.default },
    },
    '../theme': { colors: {}, typography: {}, layout: {} },
    '../utils/throttledTask': load('src/utils/throttledTask.js', {}, timerGlobals),
    '../utils/searchKeyword': load('src/utils/searchKeyword.js', {}),
    '../api/address/search': { searchAddresses: async request => { calls.push(request); return []; } },
  }, timerGlobals, ['AddressSearchScreen']);
  const render = () => view.render(api.AddressSearchScreen, {});
  render(); view.flushEffects();
  const type = value => { find(render(), 'TextInput').props.onChangeText(value); render(); view.flushEffects(); };
  const tick = () => timers.findLast(timer => timer.delay === 1000);
  type('\u3131'); await tick().callback(); assert.equal(calls.length, 0);
  const waiting = tick(); type('\uac00'); assert.equal(tick(), waiting);
  await waiting.callback(); assert.equal(calls.length, 1); assert.equal(calls[0].keyword, '\uac00');
});
