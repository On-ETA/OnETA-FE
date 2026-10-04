const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const babel = require('@babel/core');
function fixture(send) {
  const exports = {};
  let cache = [{ userBusId: 10, enabled: true, raw: { active: true } }, { userBusId: 11, enabled: true }];
  const { code } = babel.transformSync(fs.readFileSync('src/api/notifications/depot.js', 'utf8'), {
    configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  vm.runInNewContext(code, { exports, require(name) {
    return {
      '../auth/tokens': { getAccessToken: () => 'access' },
      '../auth/reissue': { reissueAuthTokens: async () => ({ accessToken: 'renewed' }) },
      '../client': { requestJson: send },
      '../homeCache': { homeCacheKeys: { depotNotifications: 'depot' }, readHomeCache: () => cache,
        writeHomeCache: (_, value) => { cache = value; return value; }, removeHomeCache() {} },
    }[name];
  }});
  return { api: exports, cache: () => cache };
}
test('depot toggle sends boolean active and updates only the matching cached bus after success', async () => {
  const calls = [];
  const f = fixture(async options => { calls.push(options); return { code: 'SUCCESS' }; });
  for (const active of [false, true]) {
    await f.api.updateDepotNotificationStatus({ userBusId: '10', active });
    assert.equal(calls.at(-1).path, '/api/notifications/depot/10/status');
    assert.equal(calls.at(-1).method, 'PATCH');
    assert.equal(calls.at(-1).body.active, active);
    assert.equal(calls.at(-1).accessToken, 'access');
    assert.equal(f.cache()[0].enabled, active);
    assert.equal(f.cache()[0].raw.active, active);
    assert.equal(f.cache()[1].enabled, true);
  }
});
test('invalid status input does not call the server', async () => {
  let calls = 0;
  const f = fixture(async () => { calls++; });
  await assert.rejects(f.api.updateDepotNotificationStatus({ userBusId: 10, active: null }));
  await assert.rejects(f.api.updateDepotNotificationStatus({ active: false }));
  assert.equal(calls, 0);
});
test('server rejection leaves depot toggle cache unchanged', async () => {
  const f = fixture(async () => { throw Object.assign(new Error('등록된 버스 정보를 찾을 수 없습니다.'), { status: 400 }); });
  await assert.rejects(f.api.updateDepotNotificationStatus({ userBusId: 10, active: false }), /등록된 버스/);
  assert.equal(f.cache()[0].enabled, true);
});

test('fresh depot list reflects backend auto-deactivation despite an older active cache', async () => {
  const calls = [];
  const f = fixture(async options => {
    calls.push(options);
    return { code: 'SUCCESS', data: [{ userBusId: 10, active: false }, { userBusId: 11, active: true }] };
  });
  assert.equal(f.cache()[0].enabled, true);
  const alarms = await f.api.getMyDepotNotifications({ forceRefresh: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/api/notifications/depot/my');
  assert.equal(calls[0].method, 'GET');
  assert.equal(alarms[0].enabled, false);
  assert.equal(alarms[1].enabled, true);
  assert.equal(f.cache()[0].enabled, false);
});
