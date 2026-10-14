const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const { test } = require('node:test');
function fixture(send = async () => ({ code: 'SUCCESS' })) {
  const slots = [], calls = [], navigations = [], alerts = [];
  let cursor = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useMemo: fn => fn(), useRef: initial => slots[cursor++] ??= { current: initial },
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
    },
  };
  const mocks = {
    react, 'react-native': { Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: value => value }, Alert: { alert: (...args) => alerts.push(args) } },
    '../components': { PrimaryButton: 'PrimaryButton' }, '../theme': { colors: {}, typography: {}, layout: {} },
    '../api/auth/consent': { agreeToSignupTerms: options => { calls.push(options); return send(options); } },
  };
  const exports = {};
  const { code } = babel.transformSync(fs.readFileSync('src/screens/TermsAgreementScreen.js', 'utf8'), { configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs', '@babel/plugin-transform-react-jsx'] });
  vm.runInNewContext(code, { exports, require: name => mocks[name] ?? {} });
  return { calls, navigations, alerts,
    render(props = {}) { cursor = 0; return exports.TermsAgreementScreen({ tempId: 123, onConfirmPress: response => navigations.push(response), ...props }); },
  };
}
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  return [...(!Array.isArray(tree) && predicate(tree) ? [tree] : []),
    ...(Array.isArray(tree) ? tree : tree.children ?? []).flatMap(child => nodes(child, predicate))];
}
const checks = tree => nodes(tree, node => node.props.accessibilityRole === 'checkbox');
const button = tree => nodes(tree, node => node.type === 'PrimaryButton')[0];
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

test('the age checkbox is required; checking terms never calls the API until the enabled button is pressed', async () => {
  const request = deferred(), f = fixture(() => request.promise);
  assert.equal(checks(f.render()).length, 5);
  for (const checkbox of checks(f.render()).slice(1, 4)) checkbox.props.onPress();
  assert.equal(button(f.render()).props.disabled, true);
  await button(f.render()).props.onPress(); assert.equal(f.calls.length, 0);
  checks(f.render())[0].props.onPress();
  assert.equal(button(f.render()).props.disabled, false);
  assert.equal(f.calls.length, 0); assert.equal(f.navigations.length, 0);
  const pending = button(f.render()).props.onPress();
  assert.equal(f.calls.length, 1); assert.equal(f.navigations.length, 0);
  assert.equal(f.calls[0].tempId, 123); assert.equal(f.calls[0].serviceTermsAgreement, true);
  assert.equal(f.calls[0].personalInfoAgreement, true); assert.equal(f.calls[0].notificationAgreement, true);
  request.resolve({ code: 'SUCCESS' }); await pending; assert.equal(f.navigations.length, 1);
});

test('select-all includes age confirmation and repeated taps during submission do not duplicate requests', async () => {
  const request = deferred(), f = fixture(() => request.promise);
  checks(f.render()).at(-1).props.onPress();
  assert.ok(checks(f.render()).every(node => node.props.accessibilityState.checked));
  assert.equal(f.calls.length, 0);
  const confirm = button(f.render()).props.onPress;
  const pending = confirm(); await confirm(); assert.equal(f.calls.length, 1);
  assert.equal(button(f.render()).props.disabled, true);
  checks(f.render()).at(-1).props.onPress();
  assert.ok(checks(f.render()).every(node => node.props.accessibilityState.checked));
  request.resolve({ code: 'SUCCESS' }); await pending;
});

test('unchecking age after select-all disables completion and never submits', async () => {
  const f = fixture(); checks(f.render()).at(-1).props.onPress(); checks(f.render())[0].props.onPress();
  assert.equal(button(f.render()).props.disabled, true);
  await button(f.render()).props.onPress(); assert.equal(f.calls.length, 0); assert.equal(f.navigations.length, 0);
});

test('API transport/business failures stay on the consent page and allow retry', async () => {
  for (const send of [async () => { throw new Error('offline'); }, async () => ({ code: 'C002', message: 'rejected' })]) {
    const f = fixture(send); checks(f.render()).at(-1).props.onPress(); await button(f.render()).props.onPress();
    assert.equal(f.calls.length, 1); assert.equal(f.navigations.length, 0); assert.equal(f.alerts.length, 1);
    assert.equal(button(f.render()).props.disabled, false);
  }
});
