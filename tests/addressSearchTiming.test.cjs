const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const { test } = require('node:test');
function load(file, mocks = {}, globals = {}) {
  const exports = {};
  const { code } = babel.transformSync(fs.readFileSync(file, 'utf8'), { configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'] });
  vm.runInNewContext(code, { exports, AbortController, ...globals, require: name => mocks[name] ?? {} });
  return exports;
}
function fixture(fallbackToRoadAddress = false, request = async () => []) {
  const slots = [], effects = [], timers = new Map(), calls = [];
  let cursor = 0, now = 0, timerId = 0, props = { keyword: '', fallbackToRoadAddress };
  const react = {
    useRef: initial => slots[cursor++] ??= { current: initial },
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = value; }];
    },
    useEffect(fn, deps) {
      const index = cursor++, prior = slots[index];
      if (!prior || deps.some((value, i) => !Object.is(value, prior.deps[i]))) {
        slots[index] = { deps, cleanup: prior?.cleanup };
        effects.push(() => { slots[index].cleanup?.(); slots[index].cleanup = fn(); });
      }
    },
  };
  const clock = {
    setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  const hook = load('src/hooks/useAddressSearch.js', {
    react, '../utils/throttledTask': load('src/utils/throttledTask.js', {}, clock),
    '../utils/searchKeyword': load('src/utils/searchKeyword.js'),
    '../api/address/search': { searchAddresses: options => { calls.push({ ...options, at: now }); return request(options); } },
  });
  function render(next) {
    props = { ...props, ...next }; cursor = 0;
    const result = hook.useAddressSearch(props);
    effects.splice(0).forEach(fn => fn());
    return result;
  }
  return { calls, render, input: keyword => render({ keyword }),
    async advance(to) {
      while (true) {
        const next = [...timers].filter(([, value]) => value.at <= to).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        timers.delete(next[0]); now = next[1].at; next[1].fn();
        await new Promise(setImmediate);
      }
      now = to;
    },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

for (const fallback of [false, true]) {
  test((fallback ? 'address registration' : 'origin/destination') + ' uses the latest input every second without waiting for typing to stop', async () => {
    const f = fixture(fallback); f.input('S'); await f.advance(300); f.input('Se');
    await f.advance(900); f.input('Seoul'); await f.advance(999); assert.equal(f.calls.length, 0);
    await f.advance(1000); assert.equal(f.calls[0].keyword, 'Seoul');
    await f.advance(1100); f.input('Seoul S'); await f.advance(1900); f.input('Seoul Statio');
    await f.advance(2000); assert.equal(f.calls[1].keyword, 'Seoul Statio');
    assert.equal(f.calls[0].at, 1000); assert.equal(f.calls[1].at, 2000);
    assert.equal(f.calls[1].fallbackToRoadAddress, fallback);
    await f.advance(10000); assert.equal(f.calls.length, 2); f.unmount();
  });
}

test('unfinished Korean delays each tick by one second and clearing cancels the deferred search', async () => {
  const f = fixture(true); f.input('\u3131'); await f.advance(2000); assert.equal(f.calls.length, 0);
  await f.advance(2200); f.input('\uAC00'); await f.advance(2999); assert.equal(f.calls.length, 0);
  await f.advance(3000); assert.equal(f.calls[0].keyword, '\uAC00');
  f.input('\u3134'); f.input(''); await f.advance(8000); assert.equal(f.calls.length, 1);
});

test('changing text rejects stale results and leaving the screen cancels both pending and in-flight searches', async () => {
  let resolve;
  const f = fixture(true, () => new Promise(done => { resolve = done; }));
  f.input('old'); await f.advance(1000); f.input('new');
  assert.equal(f.calls[0].signal.aborted, true);
  resolve([{ name: 'old result' }]); await new Promise(setImmediate);
  assert.equal(f.render().results.length, 0);
  f.unmount(); await f.advance(5000); assert.equal(f.calls.length, 1);
});
