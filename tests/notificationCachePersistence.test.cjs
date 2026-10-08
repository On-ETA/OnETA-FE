const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const babel = require('@babel/core');

function load(file, mocks) {
  const { code } = babel.transformSync(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => mocks[name] });
  return exports;
}

function deferred() {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
}

function cacheFixture(overrides = {}) {
  const disk = new Map();
  const storage = { setItem: async (key, value) => disk.set(key, value),
    removeItem: async key => disk.delete(key), getItem: async key => disk.get(key) ?? null, ...overrides };
  const cache = load('src/api/homeCache.js', {
    'react-native': { Platform: { OS: 'android' } },
    '@react-native-async-storage/async-storage': storage,
  });
  return { cache, disk };
}

test('logout cache deletion waits for earlier native writes so old session data cannot reappear on disk', async () => {
  const write = deferred();
  let started = false;
  const { cache, disk } = cacheFixture({ setItem: async (key, value) => {
    started = true; await write.promise; disk.set(key, value);
  } });
  cache.writeHomeCache(cache.homeCacheKeys.scheduleNotifications, ['old account']);
  await new Promise(setImmediate);
  assert.equal(started, true);
  const clearing = cache.clearHomeCacheAsync();
  assert.equal(cache.readHomeCache(cache.homeCacheKeys.scheduleNotifications), null);
  write.resolve();
  await clearing;
  assert.equal(disk.has('oneta.homeCache.scheduleNotifications'), false);
});

test('new native writes stay ordered behind removals and reads wait for pending removals', async () => {
  const removing = deferred();
  const { cache, disk } = cacheFixture({ removeItem: async key => { await removing.promise; disk.delete(key); } });
  const key = cache.homeCacheKeys.scheduleNotifications;
  await cache.writeHomeCacheAsync(key, ['old']);
  const removal = cache.removeHomeCache(key);
  const reading = cache.readHomeCacheAsync(key);
  removing.resolve();
  await removal;
  assert.equal(await reading, null);
  const deletingAgain = cache.removeHomeCache(key);
  const write = cache.writeHomeCacheAsync(key, ['new']);
  await Promise.all([deletingAgain, write]);
  assert.equal(disk.get('oneta.homeCache.scheduleNotifications'), '["new"]');
});

test('an old native storage read cannot restore cache after logout cleared it', async () => {
  const reading = deferred();
  const { cache } = cacheFixture({ getItem: () => reading.promise });
  const key = cache.homeCacheKeys.scheduleNotifications;
  const pending = cache.readHomeCacheAsync(key);
  await new Promise(setImmediate);
  await cache.clearHomeCacheAsync();
  reading.resolve('["old account"]');
  assert.equal(await pending, null);
  assert.equal(cache.readHomeCache(key), null);
});

test('logout cancels the auth session before its final cache deletion, including expired-session errors', async () => {
  for (const status of [undefined, 401]) {
    const order = [];
    const { logout } = load('src/api/auth/logout.js', {
      '../homePreload': { cancelHomePreload: async () => order.push('cancel preload') },
      '../homeCache': { clearHomeCacheAsync: async () => order.push('clear cache') },
      './tokens': { getAccessToken: () => 'access', clearAuthTokens: async () => order.push('clear auth') },
      '../client': { requestJson: async () => {
        order.push('request');
        if (status) throw Object.assign(new Error('expired'), { status });
        return { code: 'SUCCESS' };
      } },
    });
    if (status) await assert.rejects(logout(), /expired/);
    else await logout();
    assert.deepEqual(order, ['cancel preload', 'request', 'clear auth', 'clear cache']);
  }
});

test('failed logout keeps the current auth and cache instead of discarding them before server confirmation', async () => {
  let cleared = false;
  const { logout } = load('src/api/auth/logout.js', {
    '../homePreload': { cancelHomePreload: async () => {} },
    '../homeCache': { clearHomeCacheAsync: async () => { cleared = true; } },
    './tokens': { getAccessToken: () => 'access', clearAuthTokens: async () => { cleared = true; } },
    '../client': { requestJson: async () => { throw Object.assign(new Error('unavailable'), { status: 503 }); } },
  });
  await assert.rejects(logout(), /unavailable/);
  assert.equal(cleared, false);
});
