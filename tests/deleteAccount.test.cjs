const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const { test } = require('node:test');

function load(file, mocks) {
  const exports = {};
  const { code } = babel.transformSync(fs.readFileSync(file, 'utf8'), {
    configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs', '@babel/plugin-transform-react-jsx'],
  });
  vm.runInNewContext(code, { exports, require: name => mocks[name] ?? {} });
  return exports;
}

function fixture(send = async () => {}) {
  const slots = []; let cursor = 0, calls = 0, completions = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useRef: initial => slots[cursor++] ??= { current: initial },
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
    },
  };
  const { DeleteAccountScreen } = load('src/screens/DeleteAccountScreen.js', {
    react,
    'react-native': { Pressable: 'Pressable', Text: 'Text', View: 'View', ScrollView: 'ScrollView', StyleSheet: { create: value => value } },
    '../components': { AppScreen: 'AppScreen', Header: 'Header', PrimaryButton: 'PrimaryButton' },
    '../theme': { colors: {}, typography: {} },
    '../api/user': { deleteUser: async () => { calls++; return send(); } },
  });
  return {
    render() { cursor = 0; return DeleteAccountScreen({ onCompletePress: () => completions++, onCancelPress: () => {} }); },
    calls: () => calls, completions: () => completions,
  };
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...tree.children.flatMap(nodes)];
}
const button = tree => nodes(tree).find(node => node.type === 'PrimaryButton');
const checkbox = tree => nodes(tree).find(node => node.props.accessibilityRole === 'checkbox');

test('deletion requires explicit agreement and button press, prevents duplicates, then shows completion', async () => {
  let resolve;
  const f = fixture(() => new Promise(done => { resolve = done; }));
  assert.equal(button(f.render()).props.disabled, true);
  await button(f.render()).props.onPress();
  assert.equal(f.calls(), 0);
  checkbox(f.render()).props.onPress();
  assert.equal(button(f.render()).props.disabled, false);
  assert.equal(f.calls(), 0);
  const submit = button(f.render()).props.onPress;
  const pending = submit(); await submit();
  assert.equal(f.calls(), 1);
  assert.equal(button(f.render()).props.disabled, true);
  resolve(); await pending;
  assert.equal(checkbox(f.render()), undefined);
  assert.equal(f.completions(), 0);
  button(f.render()).props.onPress();
  assert.equal(f.completions(), 1);
  await submit();
  assert.equal(f.calls(), 1);
});

test('deletion failure displays the error and allows retry without reporting success', async () => {
  let attempts = 0;
  const f = fixture(async () => { if (++attempts === 1) throw new Error('request failed'); });
  checkbox(f.render()).props.onPress();
  await button(f.render()).props.onPress();
  const alert = nodes(f.render()).find(node => node.props.accessibilityRole === 'alert');
  assert.equal(alert.children[0], 'request failed');
  assert.equal(f.completions(), 0);
  assert.equal(button(f.render()).props.disabled, false);
  await button(f.render()).props.onPress();
  assert.equal(checkbox(f.render()), undefined);
  assert.equal(f.calls(), 2);
});

test('Google return destination is restricted to deletion and consumed once', async () => {
  const values = new Map();
  const api = load('src/navigation/authReturn.js', {
    '@react-native-async-storage/async-storage': {
      getItem: async key => values.get(key),
      setItem: async (key, value) => values.set(key, value),
      removeItem: async key => values.delete(key),
    },
    './routes': { routes: { deleteAccount: 'DeleteAccount' } },
  });
  await api.rememberAuthReturnRoute('DeleteAccount');
  assert.equal(await api.consumeAuthReturnRoute(), 'DeleteAccount');
  assert.equal(await api.consumeAuthReturnRoute(), null);
  await api.rememberAuthReturnRoute('DeleteAccount');
  await api.rememberAuthReturnRoute('https://untrusted.example');
  assert.equal(await api.consumeAuthReturnRoute(), null);
});
