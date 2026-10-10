const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const { test } = require('node:test');

function fixture(file, mocks) {
  const slots = [], effects = [];
  let cursor = 0, first = true;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect(callback) { if (first) effects.push(callback); },
  };
  const exports = {};
  const { code } = babel.transformSync(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs', '@babel/plugin-transform-react-jsx'],
  });
  vm.runInNewContext(code, {
    exports, AbortController,
    require: name => name === 'react' ? react : name === 'react-native' ? {
      TextInput: 'TextInput', View: 'View', Text: 'Text', Platform: { OS: 'web', select: options => options.web ?? options.default },
      StyleSheet: { create: styles => styles },
    } : mocks[name] ?? {},
  });
  const Component = Object.values(exports).find(value => typeof value === 'function');
  return {
    render() { cursor = 0; const tree = Component({}); first = false; return tree; },
    flush() { effects.splice(0).forEach(effect => effect()); },
  };
}

function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  const children = Array.isArray(tree) ? tree : tree.children ?? [];
  return [...(predicate(tree) ? [tree] : []), ...children.flatMap(child => nodes(child, predicate))];
}

function account(cached) {
  let calls = 0, resolve;
  const pending = new Promise(done => { resolve = done; });
  const f = fixture('src/screens/AccountInfoScreen.js', {
    '../api/homeCache': { homeCacheKeys: { myPage: 'profile' }, readHomeCache: () => cached },
    '../api/mypage': { getMyPage: () => { calls++; return pending; } },
    '../components': { PrimaryButton: 'PrimaryButton' },
    '../theme': { colors: {}, layout: {}, typography: {} },
  });
  return { ...f, resolve, calls: () => calls };
}

test('account info displays cached nickname immediately with editable fields and no entry request', () => {
  const f = account({ email: 'cached@example.com', nickname: 'cached nickname' });
  const tree = f.render(), input = nodes(tree, node => node.type === 'TextInput')[0];
  assert.equal(input.props.value, 'cached nickname'); assert.equal(input.props.editable, true);
  assert.equal(nodes(tree, node => node.type === 'PrimaryButton')[0].props.disabled, false);
  f.flush(); assert.equal(f.calls(), 0);
});

test('account info without cache still fetches and enables editing after its first response', async () => {
  const f = account(null);
  assert.equal(nodes(f.render(), node => node.type === 'TextInput')[0].props.editable, false);
  f.flush(); assert.equal(f.calls(), 1);
  f.resolve({ email: 'loaded@example.com', nickname: 'loaded nickname' }); await new Promise(setImmediate);
  const input = nodes(f.render(), node => node.type === 'TextInput')[0];
  assert.equal(input.props.value, 'loaded nickname'); assert.equal(input.props.editable, true);
});

test('custom alarms display cached cards before effects and retain them while entry loads are pending', () => {
  const garage = [{ id: 1, routeNumber: '123' }], schedules = [{ id: 2, routeName: 'cached route' }];
  const f = fixture('src/screens/home/custom-alarm/CustomAlarmScreen.js', {
    '../../../api/homeCache': {
      homeCacheKeys: { depotNotifications: 'depot', scheduleNotifications: 'schedule' },
      readHomeCache: key => key === 'depot' ? garage : schedules,
    },
    '../../../api/notifications/depot': { getMyDepotNotifications: () => new Promise(() => {}) },
    '../../../api/notifications/arrival': { getArrivalNotifications: () => new Promise(() => {}) },
    '../../../notifications/events': { FCM_NOTIFICATION_TYPES: {}, subscribeNotifications: () => () => {} },
    '../../../theme': { colors: {}, typography: {} },
  });
  const cards = tree => nodes(tree, node => Boolean(node.props?.alarm));
  assert.equal(cards(f.render()).length, 2);
  f.flush(); const visible = cards(f.render());
  assert.equal(visible.length, 2); assert.equal(visible[0].props.alarm, garage[0]);
  assert.equal(visible[1].props.alarm, schedules[0]);
});
