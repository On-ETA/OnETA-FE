const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const babel = require('@babel/core');
function fixture(send) {
  const exports = {};
  const calls = [];
  const cache = new Map();
  const { code } = babel.transformSync(fs.readFileSync(path.join(__dirname, '../src/api/notifications/arrival.js'), 'utf8'), {
    configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  vm.runInNewContext(code, { exports, URLSearchParams, require(name) {
    return {
      '../auth/tokens': { getAccessToken: () => 'access' },
      '../auth/reissue': { reissueAuthTokens: async () => { throw new Error('unexpected token refresh'); } },
      '../client': { requestJson: async options => { calls.push(options); return send ? send(options) : { code: 'SUCCESS', data: [] }; } },
      '../homeCache': { homeCacheKeys: { scheduleNotifications: 'schedule', hiddenArrivalNotifications: 'hidden' },
        readHomeCache: (key, fallback) => cache.get(key) ?? fallback,
        writeHomeCache: (key, value) => { cache.set(key, value); return value; }, removeHomeCache: key => cache.delete(key) },
    }[name];
  }});
  return { api: exports, calls };
}

test('route reset saves to the existing arrival ID without creating a new schedule', async () => {
  const f = fixture();
  const payload = { routeName: 'updated route', targetArrivalTime: '13:25:00', scheduleType: 'NORMAL',
    reminderOffsetMinutes: [10, 30], repeatDays: ['MON'], routeDetails: JSON.stringify({ route: { routeId: 'new-route' } }) };
  await f.api.saveArrivalNotification({ id: 89, payload });
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].method, 'PATCH');
  assert.equal(f.calls[0].path, '/api/notifications/arrival/89');
  assert.equal(f.calls[0].accessToken, 'access');
  assert.equal(JSON.stringify(f.calls[0].body), JSON.stringify(payload));
});

test('new schedule without an ID continues to use registration POST', async () => {
  const f = fixture();
  await f.api.saveArrivalNotification({ payload: { targetArrivalTime: '13:25:00' } });
  assert.equal(f.calls[0].method, 'POST');
  assert.equal(f.calls[0].path, '/api/notifications/schedules');
  assert.equal(f.calls[0].body.scheduleType, 'NORMAL');
});

test('failed route update never falls back to creating a duplicate schedule', async () => {
  const f = fixture(async () => { throw Object.assign(new Error('not found'), { status: 400 }); });
  await assert.rejects(f.api.saveArrivalNotification({ id: 89, payload: {} }), /not found/);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].method, 'PATCH');
});

test('first and last transit resets load and update the same arrival ID and preserve schedule settings', async () => {
  for (const scheduleType of ['FIRST_TRANSIT', 'LAST_TRANSIT']) {
    const detail = { notificationId: 89, scheduleType, routeName: 'saved route', targetArrivalTime: '13:25:00',
      reminderOffsetMinutes: [5, 30], repeatDays: ['MON', 'FRI'], route: { routeId: 'old-route', segments: [] } };
    const f = fixture(async options => options.method === 'GET' ? { code: 'SUCCESS', data: detail } : { code: 'SUCCESS' });
    const existing = await f.api.getArrivalNotificationById({ id: 89 });
    await f.api.updateArrivalNotification({ id: existing.notificationId, payload: {
      scheduleType: existing.scheduleType, targetArrivalTime: existing.targetArrivalTime,
      reminderOffsetMinutes: existing.reminderOffsetMinutes, repeatDays: existing.repeatDays,
      routeDetails: JSON.stringify({ routeId: 'new-route', segments: [] }),
    } });
    assert.equal(f.calls.length, 2);
    assert.equal(f.calls[0].method, 'GET');
    assert.equal(f.calls[1].method, 'PATCH');
    assert.equal(f.calls[0].path, '/api/notifications/arrival/89');
    assert.equal(f.calls[1].path, '/api/notifications/arrival/89');
    assert.equal(f.calls[1].body.scheduleType, scheduleType);
    assert.equal(JSON.stringify(f.calls[1].body.reminderOffsetMinutes), '[5,30]');
    assert.equal(JSON.stringify(f.calls[1].body.repeatDays), '["MON","FRI"]');
  }
});
