const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const { test } = require('node:test');

function fixture() {
  let now = 0, nextId = 0;
  const timers = new Map();
  const calls = [];
  const exports = {};
  const { code } = babel.transformSync(fs.readFileSync(path.join(__dirname, '../src/utils/throttledTask.js'), 'utf8'), {
    configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  vm.runInNewContext(code, {
    exports,
    setTimeout: (callback, delay) => { const id = ++nextId; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout: id => timers.delete(id),
  });
  const scheduler = exports.createThrottledTask(1000);
  return {
    calls, scheduler,
    input: keyword => scheduler.schedule(() => calls.push({ keyword, at: now })),
    advance(to) {
      while (true) {
        const next = [...timers].filter(([, timer]) => timer.at <= to).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        timers.delete(next[0]); now = next[1].at; next[1].callback();
      }
      now = to;
    },
    timers: () => timers.size,
  };
}

test('uninterrupted typing and deletion query the latest text every second, rather than waiting until typing stops', () => {
  const f = fixture();
  f.input('S'); f.advance(300); f.input('Se'); f.advance(900); f.input('Seoul');
  f.advance(999); assert.equal(f.calls.length, 0);
  f.advance(1000); assert.deepEqual(f.calls, [{ keyword: 'Seoul', at: 1000 }]);
  f.advance(1200); f.input('Seoul S'); f.advance(1500); f.input('Seoul Station');
  f.advance(1900); f.input('Seoul Statio'); f.advance(2000);
  assert.deepEqual(f.calls[1], { keyword: 'Seoul Statio', at: 2000 });
  f.advance(2500); f.input('Seoul St'); f.advance(2800); f.input('Seoul'); f.advance(3000);
  assert.deepEqual(f.calls[2], { keyword: 'Seoul', at: 3000 });
  f.advance(10000); assert.equal(f.calls.length, 3); assert.equal(f.timers(), 0);
});

test('stopping mid-window still queries the final text at the next tick without repeating unchanged searches', () => {
  const f = fixture(); f.input('Seoul'); f.advance(1000);
  f.advance(1100); f.input('Seoul Station'); f.advance(1999); assert.equal(f.calls.length, 1);
  f.advance(2000); assert.deepEqual(f.calls[1], { keyword: 'Seoul Station', at: 2000 });
  f.advance(10000); assert.equal(f.calls.length, 2); assert.equal(f.timers(), 0);
});

test('clearing, pin selection, or leaving the screen cancels pending text searches and allows a fresh input window', () => {
  const f = fixture(); f.input('old'); f.advance(400); f.scheduler.cancel();
  f.advance(2000); assert.equal(f.calls.length, 0); assert.equal(f.timers(), 0);
  f.input('new'); f.advance(2999); assert.equal(f.calls.length, 0);
  f.advance(3000); assert.deepEqual(f.calls, [{ keyword: 'new', at: 3000 }]);
  f.input('pending'); f.scheduler.cancel(); f.advance(10000); assert.equal(f.calls.length, 1);
});
