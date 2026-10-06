const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const babel = require('@babel/core');

const exportsObject = {};
const { code } = babel.transformSync(fs.readFileSync(path.join(__dirname, '../src/utils/currentLocationRequest.js'), 'utf8'), {
  configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
});
vm.runInNewContext(code, { exports: exportsObject, setTimeout, clearTimeout });
const { createCurrentLocationRequest } = exportsObject;

test('entry button and map share the same pending lookup and resolved coordinates', async () => {
  let calls = 0;
  let resolve;
  const result = { latitude: 37.5, longitude: 127.1 };
  const request = createCurrentLocationRequest(() => {
    calls++;
    return new Promise(done => { resolve = done; });
  });
  const buttonRequest = request.getCoordinate();
  const mapRequest = request.getCoordinate();
  assert.equal(buttonRequest, mapRequest);
  assert.equal(request.getCachedCoordinate(), null);
  await Promise.resolve();
  resolve(result);
  assert.equal(await buttonRequest, result);
  assert.equal(await request.getCoordinate(), result);
  assert.equal(request.getCachedCoordinate(), result);
  assert.equal(calls, 1);
});

test('expired coordinates trigger a new location lookup', async () => {
  let now = 0;
  let calls = 0;
  const request = createCurrentLocationRequest(async () => ({ latitude: ++calls, longitude: 127 }), () => now);
  await request.getCoordinate();
  now = 59999;
  assert.equal((await request.getCoordinate()).latitude, 1);
  now = 60000;
  assert.equal(request.getCachedCoordinate(), null);
  assert.equal((await request.getCoordinate()).latitude, 2);
});

test('a failed preload can be retried when the map opens', async () => {
  let calls = 0;
  const request = createCurrentLocationRequest(async () => {
    if (++calls === 1) throw new Error('unavailable');
    return { latitude: 37.5, longitude: 127.1 };
  });
  await assert.rejects(request.getCoordinate(), /unavailable/);
  assert.equal(request.getCachedCoordinate(), null);
  assert.equal((await request.getCoordinate()).latitude, 37.5);
  assert.equal(calls, 2);
});

test('a stalled lookup times out, permits retry, and ignores the late result', async () => {
  let resolveFirst;
  let calls = 0;
  const request = createCurrentLocationRequest(() => {
    if (++calls === 1) return new Promise(resolve => { resolveFirst = resolve; });
    return Promise.resolve({ latitude: 37.5, longitude: 127.1 });
  }, Date.now, { timeoutMs: 10 });
  await assert.rejects(request.getCoordinate(), { code: 'LOCATION_TIMEOUT' });
  await request.getCoordinate();
  resolveFirst({ latitude: 1, longitude: 1 });
  await new Promise(setImmediate);
  assert.equal(request.getCachedCoordinate().latitude, 37.5);
});
