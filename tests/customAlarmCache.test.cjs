const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const babel = require('@babel/core');

function load(file, mocks = {}, globals = {}) {
  const { code } = babel.transformSync(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs', '@babel/plugin-transform-react-jsx'],
  });
  const exports = {};
  vm.runInNewContext(code, { exports, AbortController, URLSearchParams, setTimeout, clearTimeout, console: { warn() {} }, ...globals,
    require: name => mocks[name] ?? {} });
  return exports;
}

function fixture(cached = true, send, accessToken = 'access', globals = {}) {
  const keys = { depotNotifications: 'depot', scheduleNotifications: 'schedules', firstTransitNotifications: 'first', lastTransitNotifications: 'last' };
  const cache = new Map(cached ? [['depot', []], ['schedules', []]] : []);
  const requests = [];
  let sessionId = 1;
  const authListeners = new Set();
  const auth = { getAccessToken: () => accessToken, getAuthSessionId: () => sessionId,
    subscribeAuthTokens: listener => { authListeners.add(listener); return () => authListeners.delete(listener); },
    setSession: token => { accessToken = token; sessionId++; authListeners.forEach(listener => listener()); } };
  const homeCache = { homeCacheKeys: keys,
    readHomeCache: (key, fallback) => cache.get(key) ?? fallback,
    writeHomeCache: (key, value) => { cache.set(key, value); return value; },
    readHomeCacheAsync: async (key, fallback) => cache.get(key) ?? fallback,
    writeHomeCacheAsync: async (key, value) => { cache.set(key, value); return value; },
    removeHomeCache: key => cache.delete(key) };
  const apiMocks = {
    '../homeCache': homeCache,
    '../auth/tokens': auth,
    '../client': { requestJson: async options => { requests.push(options); return send ? send(options) : { code: 'SUCCESS', data: [] }; } },
  };
  const depot = load('src/api/notifications/depot.js', apiMocks);
  const arrival = load('src/api/notifications/arrival.js', apiMocks);
  const transit = load('src/api/notifications/transit.js', apiMocks);
  const events = load('src/notifications/events.js', {
    '../api/homeCache': homeCache,
    '../api/auth/tokens': apiMocks['../auth/tokens'],
    '../api/notifications/depot': depot,
    '../api/notifications/arrival': arrival,
    '../api/notifications/transit': transit,
  }, globals);

  function mount(refreshKey = 0) {
    const state = [], effects = [], pending = [];
    let cursor = 0;
    const react = { createElement: () => null,
      useRef(initial) {
        const index = cursor++;
        if (!(index in state)) state[index] = { current: initial };
        return state[index];
      },
      useState(initial) {
        const index = cursor++;
        if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
        return [state[index], next => { state[index] = typeof next === 'function' ? next(state[index]) : next; }];
      },
      useEffect(callback, deps) {
        const index = cursor++;
        const previous = effects[index];
        if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
          pending.push(() => { previous?.cleanup?.(); effects[index] = { deps, cleanup: callback() }; });
        }
      },
    };
    const { CustomAlarmScreen } = load('src/screens/home/custom-alarm/CustomAlarmScreen.js', {
      react,
      'react-native': { Platform: { OS: 'web', select: options => options.web }, StyleSheet: { create: value => value } },
      '../../../theme': { colors: {}, typography: {} },
      '../../../api/notifications/depot': depot,
      '../../../api/notifications/arrival': arrival,
      '../../../notifications/events': events,
      '../../../api/homeCache': homeCache,
    });
    const render = async () => {
      cursor = 0;
      CustomAlarmScreen({ refreshKey });
      pending.splice(0).forEach(effect => effect());
      await new Promise(setImmediate);
    };
    return { render, state, unmount: () => effects.forEach(effect => effect?.cleanup?.()) };
  }
  return { cache, requests, events, mount, auth, arrival, depot, transit };
}

test('custom alarms reuse cached lists on entry even after a saved alarm increased the refresh key', async () => {
  const f = fixture();
  const first = f.mount(3);
  await first.render();
  first.unmount();
  await f.mount(3).render();
  assert.equal(f.requests.length, 0);
});

test('missing caches fetch my and schedules once and subsequent entry uses the saved lists', async () => {
  const f = fixture(false);
  const screen = f.mount();
  await screen.render();
  assert.deepEqual(f.requests.map(request => request.path).sort(), ['/api/notifications/depot/my', '/api/notifications/schedules']);
  screen.unmount();
  await f.mount().render();
  assert.equal(f.requests.length, 2);
});

test('normal FCM refreshes only schedules while mounted and later reentry uses the refreshed cache', async () => {
  const f = fixture();
  const screen = f.mount();
  await screen.render();
  await f.events.invalidateNotifications({ data: { type: 'normal' } });
  await screen.render();
  assert.deepEqual(f.requests.map(request => request.path), ['/api/notifications/schedules']);
  screen.unmount();
  await f.mount().render();
  assert.equal(f.requests.length, 1);
});

test('depot FCM outside custom alarms refreshes only my and next entry uses its cache', async () => {
  const f = fixture();
  const refresh = f.events.invalidateNotifications({ data: { type: 'depot' } });
  assert.equal(f.cache.has('depot'), false);
  assert.equal(f.cache.has('schedules'), true);
  assert.deepEqual(f.requests.map(request => request.path), ['/api/notifications/depot/my']);
  await refresh;
  assert.equal(f.cache.has('depot'), true);
  assert.equal(f.cache.has('schedules'), true);
  await f.mount().render();
  assert.equal(f.requests.length, 1);
});

test('a failed depot refresh does not affect the schedules cache', async () => {
  const f = fixture(true, async options => {
    if (options.path.endsWith('/my')) throw new Error('offline');
    return { code: 'SUCCESS', data: [] };
  });
  await f.events.invalidateNotifications({ data: { type: 'depot' } });
  assert.equal(f.cache.has('depot'), false);
  assert.equal(f.cache.has('schedules'), true);
});

test('FCM cache refresh does not call authenticated APIs without a login', async () => {
  const f = fixture(true, undefined, null);
  await f.events.invalidateNotifications({ data: { type: 'normal' } });
  assert.equal(f.requests.length, 0);
});

test('firstandlast FCM fetches only first and last transit APIs even with custom alarms mounted', async () => {
  const f = fixture();
  const screen = f.mount();
  await screen.render();
  await f.events.invalidateNotifications({ data: { type: 'firstandlast' } });
  await screen.render();
  assert.deepEqual(f.requests.map(request => request.path).sort(), [
    '/api/notifications/transit?scheduleType=FIRST_TRANSIT',
    '/api/notifications/transit?scheduleType=LAST_TRANSIT',
  ]);
  assert.equal(f.cache.has('depot'), true);
  assert.equal(f.cache.has('schedules'), true);
});

test('missing and unknown FCM types never fetch lists or remove unrelated caches', async () => {
  const f = fixture();
  for (const message of [undefined, {}, { data: { type: 'unknown' } }]) {
    await f.events.invalidateNotifications(message);
  }
  assert.equal(f.requests.length, 0);
  assert.equal(f.cache.has('depot'), true);
  assert.equal(f.cache.has('schedules'), true);
});

function deferred() {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
}

const quickRetries = { setTimeout: callback => setTimeout(callback, 0), clearTimeout };

test('a newer FCM cancels the old request and its late response cannot overwrite the latest cache or screen', async () => {
  const old = deferred(), recent = deferred();
  let count = 0;
  const f = fixture(true, () => (++count === 1 ? old.promise : recent.promise));
  const updates = [];
  f.events.subscribeNotifications((message, update) => updates.push({ message, update }));
  const first = f.events.invalidateNotifications({ messageId: 'old', data: { type: 'normal' } });
  const second = f.events.invalidateNotifications({ messageId: 'new', data: { type: 'normal' } });
  assert.equal(f.requests[0].signal.aborted, true);
  recent.resolve({ code: 'SUCCESS', data: [{ notificationId: 2 }] });
  await second;
  old.resolve({ code: 'SUCCESS', data: [{ notificationId: 1 }] });
  await first;
  assert.equal(f.cache.get('schedules')[0].notificationId, 2);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].message.messageId, 'new');
});

test('receiving and opening the same FCM shares the pending request and skips a second completed refresh', async () => {
  const response = deferred();
  const f = fixture(true, () => response.promise);
  const message = { messageId: 'same', data: { type: 'normal' } };
  const first = f.events.invalidateNotifications(message, { persist: true });
  const second = f.events.invalidateNotifications(message);
  assert.equal(first, second);
  response.resolve({ code: 'SUCCESS', data: [] });
  await first;
  await f.events.invalidateNotifications(message);
  assert.equal(f.requests.length, 1);
});

test('account changes abort FCM requests and prevent old responses and listeners from updating the new session', async () => {
  const response = deferred();
  const f = fixture(true, () => response.promise);
  let updates = 0;
  f.events.subscribeNotifications(() => updates++);
  const pending = f.events.invalidateNotifications({ messageId: 'old-account', data: { type: 'normal' } });
  f.auth.setSession('new-account');
  f.cache.set('schedules', [{ notificationId: 99 }]);
  assert.equal(f.requests[0].signal.aborted, true);
  response.resolve({ code: 'SUCCESS', data: [{ notificationId: 1 }] });
  await pending;
  assert.equal(f.cache.get('schedules')[0].notificationId, 99);
  assert.equal(updates, 0);
});

test('different FCM types can refresh concurrently without cancelling each other', async () => {
  const response = deferred();
  const f = fixture(true, () => response.promise);
  const schedule = f.events.invalidateNotifications({ data: { type: 'normal' } });
  const depot = f.events.invalidateNotifications({ data: { type: 'depot' } });
  assert.equal(f.requests.every(request => !request.signal.aborted), true);
  response.resolve({ code: 'SUCCESS', data: [] });
  await Promise.all([schedule, depot]);
  assert.equal(f.cache.has('schedules'), true);
  assert.equal(f.cache.has('depot'), true);
});

test('transient failures retry up to twice and deliver the eventual success without changing other lists', async () => {
  const delays = [];
  let calls = 0;
  const f = fixture(true, async () => {
    if (++calls < 3) throw Object.assign(new Error('unavailable'), { status: 503 });
    return { code: 'SUCCESS', data: [{ notificationId: 3 }] };
  }, 'access', { setTimeout: (callback, delay) => { delays.push(delay); return setTimeout(callback, 0); }, clearTimeout });
  await f.events.invalidateNotifications({ data: { type: 'normal' } });
  assert.deepEqual(delays, [300, 900]);
  assert.equal(f.requests.length, 3);
  assert.equal(f.cache.get('schedules')[0].notificationId, 3);
  assert.equal(f.cache.has('depot'), true);
});

test('exhausted failures keep existing screen data and retry only the failed type on foreground return', async () => {
  let offline = true;
  const f = fixture(true, async () => {
    if (offline) throw new Error('offline');
    return { code: 'SUCCESS', data: [{ notificationId: 8 }] };
  }, 'access', quickRetries);
  const saved = [{ notificationId: 7 }];
  f.cache.set('schedules', saved);
  const screen = f.mount();
  await screen.render();
  await f.events.invalidateNotifications({ messageId: 'retry', data: { type: 'normal' } });
  assert.equal(f.requests.length, 3);
  assert.equal(screen.state[1], saved);
  offline = false;
  await f.events.invalidateNotifications();
  assert.equal(f.requests.length, 4);
  assert.equal(f.requests.every(request => request.path === '/api/notifications/schedules'), true);
  assert.equal(screen.state[1][0].notificationId, 8);
});

test('permanent HTTP errors are not retried and unrelated missing caches do not cause extra FCM requests', async () => {
  const f = fixture(true, async () => { throw Object.assign(new Error('invalid'), { status: 400 }); });
  const screen = f.mount();
  await screen.render();
  f.cache.delete('depot');
  await f.events.invalidateNotifications({ data: { type: 'normal' } });
  await screen.render();
  assert.deepEqual(f.requests.map(request => request.path), ['/api/notifications/schedules']);
});

test('each list API rejects stale, cancelled, and previous-session responses before writing cache', async () => {
  for (const kind of ['arrival', 'depot', 'transit']) {
    const old = deferred(), recent = deferred();
    let calls = 0;
    const f = fixture(true, () => (++calls === 1 ? old.promise : recent.promise));
    const loadList = kind === 'arrival' ? f.arrival.getArrivalNotifications
      : kind === 'depot' ? f.depot.getMyDepotNotifications : f.transit.getTransitNotifications;
    const key = kind === 'arrival' ? 'schedules' : kind === 'depot' ? 'depot' : 'first';
    const previous = loadList({ forceRefresh: true });
    const rejected = assert.rejects(previous, error => error.name === 'AbortError');
    const current = loadList({ forceRefresh: true });
    recent.resolve({ code: 'SUCCESS', data: [] });
    await current;
    const cached = f.cache.get(key);
    old.resolve({ code: 'SUCCESS', data: [] });
    await rejected;
    assert.equal(f.cache.get(key), cached, kind);

    const cancelledResponse = deferred();
    const g = fixture(true, () => cancelledResponse.promise);
    const controller = new AbortController();
    const api = kind === 'arrival' ? g.arrival.getArrivalNotifications
      : kind === 'depot' ? g.depot.getMyDepotNotifications : g.transit.getTransitNotifications;
    const pending = api({ forceRefresh: true, signal: controller.signal });
    const aborted = assert.rejects(pending, error => error.name === 'AbortError');
    controller.abort();
    g.auth.setSession('new');
    g.cache.set(key, 'new-account-cache');
    cancelledResponse.resolve({ code: 'SUCCESS', data: [] });
    await aborted;
    assert.equal(g.cache.get(key), 'new-account-cache', kind);

    const sessionResponse = deferred();
    const h = fixture(true, () => sessionResponse.promise);
    const sessionApi = kind === 'arrival' ? h.arrival.getArrivalNotifications
      : kind === 'depot' ? h.depot.getMyDepotNotifications : h.transit.getTransitNotifications;
    const oldAccount = sessionApi({ forceRefresh: true });
    const sessionRejected = assert.rejects(oldAccount, error => error.name === 'AbortError');
    h.auth.setSession(null);
    h.cache.delete(key);
    sessionResponse.resolve({ code: 'SUCCESS', data: [] });
    await sessionRejected;
    assert.equal(h.cache.has(key), false, kind);
  }
});

test('logging out during retry backoff cancels the timer and never starts another API request', async () => {
  const timers = new Map();
  let id = 0;
  const f = fixture(true, async () => { throw new Error('offline'); }, 'access', {
    setTimeout: callback => { timers.set(++id, callback); return id; },
    clearTimeout: timer => timers.delete(timer),
  });
  const pending = f.events.invalidateNotifications({ data: { type: 'normal' } });
  await new Promise(setImmediate);
  assert.equal(timers.size, 1);
  f.auth.setSession(null);
  await pending;
  assert.equal(timers.size, 0);
  assert.equal(f.requests.length, 1);
});

test('first and last transit refresh independently so one failed list does not discard the other result', async () => {
  const f = fixture(true, async options => {
    if (options.path.endsWith('LAST_TRANSIT')) throw Object.assign(new Error('invalid'), { status: 400 });
    return { code: 'SUCCESS', data: [] };
  });
  const result = await f.events.invalidateNotifications({ data: { type: 'firstandlast' } });
  assert.equal(result.find(item => item.scheduleType === 'FIRST_TRANSIT').status, 'fulfilled');
  assert.equal(result.find(item => item.scheduleType === 'LAST_TRANSIT').status, 'rejected');
  assert.equal(f.cache.has('first'), true);
  assert.equal(f.cache.has('last'), false);
  assert.equal(f.cache.has('schedules'), true);
});

test('a throwing subscriber cannot stop other screens from receiving an update', async () => {
  const f = fixture();
  let received = 0;
  f.events.subscribeNotifications(() => { throw new Error('screen failed'); });
  f.events.subscribeNotifications(() => received++);
  await f.events.invalidateNotifications({ data: { type: 'normal' } });
  assert.equal(received, 1);
});
