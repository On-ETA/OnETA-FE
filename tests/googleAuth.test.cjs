const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const babel = require('@babel/core');

function fixture(platform = 'web', requestJson = async () => null) {
  const exports = {};
  const { code } = babel.transformSync(fs.readFileSync('src/api/google.js', 'utf8'), {
    configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  vm.runInNewContext(code, {
    exports, URL,
    window: { location: { origin: 'https://frontend.example' } },
    require(name) {
      if (name === 'react-native') return { Platform: { OS: platform }, Linking: { openURL: async () => {} } };
      if (name === './client') return { buildApiUrl: path => `https://backend.example${path}`, requestJson };
      throw new Error(name);
    },
  });
  return exports;
}

test('web returns to code exchange callback and native uses the app deep link', () => {
  for (const [platform, redirect] of [
    ['web', 'https://frontend.example/oauth/callback'],
    ['android', 'oneta://oauth/callback'],
    ['ios', 'oneta://oauth/callback'],
  ]) {
    const url = new URL(fixture(platform).getGoogleAuthUrl());
    assert.equal(url.pathname, '/oauth2/authorization/google');
    assert.equal(url.searchParams.get('redirect_uri'), redirect);
    assert.equal(url.searchParams.has('redirectUri'), false);
  }
});

test('exchange sends POST with code and accepts both signup and login responses', async () => {
  for (const data of [{ tempId: 'signup-uuid' }, { accessToken: 'access', refreshToken: 'refresh' }]) {
    const response = { code: 'SUCCESS', data };
    const api = fixture('web', async options => {
      assert.equal(options.path, '/api/auth/oauth/google/exchange');
      assert.equal(options.method, 'POST');
      assert.equal(options.body.code, 'one-time-code');
      return response;
    });
    assert.equal(await api.exchangeGoogleAuthCode({ code: 'one-time-code' }), response);
  }
});

test('empty codes never send a request; malformed success responses fail', async () => {
  let requests = 0;
  const api = fixture('web', async () => { requests++; return { code: 'SUCCESS', data: { tempId: '' } }; });
  await assert.rejects(api.exchangeGoogleAuthCode({ code: ' ' }), /코드가 없습니다/);
  assert.equal(requests, 0);
  await assert.rejects(api.exchangeGoogleAuthCode({ code: 'valid' }), /인증 정보가 없습니다/);
});

test('expired codes and server failures retain the backend error message without retry', async () => {
  for (const code of ['C002', 'C001']) {
    let requests = 0;
    const api = fixture('web', async () => { requests++; throw Object.assign(new Error('backend message'), { code, status: 400 }); });
    await assert.rejects(api.exchangeGoogleAuthCode({ code: 'expired' }), error => error.code === code && error.message === 'backend message');
    assert.equal(requests, 1);
  }
});
