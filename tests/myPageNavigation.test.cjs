const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const babel = require('@babel/core');

function hooks() {
  const state = [];
  const effects = [];
  let cursor;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useMemo: callback => callback(),
    useEffect: callback => effects.push(callback),
    useRef: value => ({ current: value }),
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
      return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    },
  };
  return { react, render(component, props) { cursor = 0; return component(props); },
    flush: () => effects.splice(0).map(callback => callback()) };
}

function routeFixture(token = 'access', routeName = 'MyPageRoute', params = {}) {
  const h = hooks();
  const source = fs.readFileSync(path.join(__dirname, '../App.js'), 'utf8');
  const names = [routeName, 'useAuthenticatedRoute', 'createHomeScreenNavigationProps', 'navigateTo', 'goBackOrReset', 'resetTo'];
  const ast = babel.parseSync(source, { configFile: false, babelrc: false, parserOpts: { plugins: ['jsx'] } });
  const selected = ast.program.body.filter(node => node.type === 'FunctionDeclaration' && names.includes(node.id.name))
    .map(node => source.slice(node.start, node.end)).join('\n');
  const { code } = babel.transformSync(selected + `\nexports.Route = ${routeName};`, {
    configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-react-jsx'],
  });
  const exports = {};
  let preloads = 0;
  const calls = [];
  const navigation = { navigate: name => calls.push(name), canGoBack: () => true, goBack: () => calls.push('back'), reset: state => calls.push(state.routes[0].name) };
  vm.runInNewContext(code, { exports, React: h.react, useIsFocused: () => true,
    MyPageScreen: 'MyPageScreen', HomeScreen: 'HomeScreen', CustomAlarmScreen: 'CustomAlarmScreen',
    InquiryScreen: 'InquiryScreen', NoticesScreen: 'NoticesScreen', NoticeDetailScreen: 'NoticeDetailScreen',
    NotificationsScreen: 'NotificationsScreen', AccountInfoScreen: 'AccountInfoScreen', ChangePasswordScreen: 'ChangePasswordScreen',
    routes: { home: 'Home', login: 'Login', accountInfo: 'AccountInfo', notifications: 'Notifications' },
    getAccessToken: () => token, subscribeAuthRequired: () => () => {}, blurActiveElement() {},
    subscribeNotifications: () => () => {},
    FCM_NOTIFICATION_TYPES: { transit: 'firstandlast' },
    cancelHomePreload: async () => {}, clearHomeCacheAsync: async () => {}, setAuthTokens: async () => {},
    preloadHomeCache: async () => { preloads++; },
  });
  return { h, calls, navigation, preloads: () => preloads, render: () => h.render(exports.Route, { navigation, route: { params } }) };
}

test('my page renders directly on the first frame and does not preload home data', async () => {
  const f = routeFixture();
  const tree = f.render();
  assert.equal(tree.type, 'MyPageScreen');
  f.h.flush();
  await new Promise(setImmediate);
  assert.equal(f.preloads(), 0);
  tree.props.onBackPress();
  tree.props.onProfilePress();
  tree.props.onOpenNotifications();
  assert.deepEqual(f.calls, ['back', 'AccountInfo', 'Notifications']);
});

test('my page does not render without a session and redirects to login', async () => {
  const f = routeFixture(null);
  assert.equal(f.render(), null);
  f.h.flush();
  await new Promise(setImmediate);
  assert.deepEqual(f.calls, ['Login']);
});

const protectedRoutes = ['HomeRoute', 'CustomAlarmRoute', 'MyPageRoute', 'InquiryRoute', 'NoticesRoute',
  'NoticeDetailRoute', 'NotificationsRoute', 'AccountInfoRoute', 'ChangePasswordRoute'];

test('every protected page renders on the first frame with an existing session; only home preloads', async () => {
  for (const routeName of protectedRoutes) {
    const f = routeFixture('access', routeName);
    assert.ok(f.render(), routeName);
    f.h.flush();
    await new Promise(setImmediate);
    assert.equal(f.preloads(), routeName === 'HomeRoute' ? 1 : 0, routeName);
    assert.equal(f.calls.length, 0, routeName);
  }
});

test('every protected page blocks rendering and redirects without an authenticated session', async () => {
  for (const routeName of protectedRoutes) {
    const f = routeFixture(null, routeName);
    assert.equal(f.render(), null, routeName);
    f.h.flush();
    await new Promise(setImmediate);
    assert.deepEqual(f.calls, ['Login'], routeName);
  }
});

test('a route carrying new login tokens waits for token preparation before rendering', async () => {
  const f = routeFixture('old-access', 'HomeRoute', { accessToken: 'new-access', refreshToken: 'new-refresh' });
  assert.equal(f.render(), null);
  f.h.flush();
  await new Promise(setImmediate);
  assert.equal(f.render().type, 'HomeScreen');
  assert.equal(f.preloads(), 1);
});

function profileFixture(initialCache, getData) {
  const h = hooks();
  let cached = initialCache;
  const exports = {};
  const { code } = babel.transformSync(fs.readFileSync(path.join(__dirname, '../src/screens/MyPageScreen.js'), 'utf8'), {
    configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs', '@babel/plugin-transform-react-jsx'],
  });
  const mocks = { react: h.react,
    'react-native': { View: 'View', Text: 'Text', ScrollView: 'ScrollView', Pressable: 'Pressable', StyleSheet: { create: value => value } },
    '../../package.json': { version: '1.0.0' }, '../theme': { colors: {}, typography: new Proxy({}, { get: () => ({}) }) },
    '../api/homeCache': { homeCacheKeys: { myPage: 'myPage' }, readHomeCache: () => cached },
    '../api/mypage': { getMyPage: getData ?? (async () => cached) },
  };
  vm.runInNewContext(code, { exports, AbortController, require: name => mocks[name] ?? {} });
  return { h, setCache: value => { cached = value; }, render: (props = {}) => h.render(exports.MyPageScreen, props) };
}

function content(tree) {
  if (typeof tree === 'string') return tree;
  if (!tree || typeof tree !== 'object') return '';
  return (Array.isArray(tree) ? tree : tree.children ?? []).map(content).join('');
}

test('profile displays cached values immediately and refreshes them on return', async () => {
  const f = profileFixture({ nickname: 'saved name', email: 'user@example.com' });
  assert.ok(content(f.render()).includes('saved nameuser@example.com'));
  const cleanups = f.h.flush();
  await new Promise(setImmediate);
  cleanups.forEach(cleanup => cleanup?.());
  f.render({ isFocused: false });
  f.h.flush();
  f.setCache({ nickname: 'updated name', email: 'user@example.com' });
  f.render({ isFocused: true });
  f.h.flush();
  await new Promise(setImmediate);
  assert.ok(content(f.render()).includes('updated nameuser@example.com'));
});

test('profile keeps cached values if fetching fails and never displays sample user details', async () => {
  const f = profileFixture({ nickname: 'saved name', email: 'user@example.com' }, async () => { throw new Error('offline'); });
  f.render();
  f.h.flush();
  await new Promise(setImmediate);
  assert.ok(content(f.render()).includes('saved nameuser@example.com'));
  const empty = content(profileFixture(null).render());
  assert.ok(!empty.includes('홍길동'));
  assert.ok(!empty.includes('abcdg@gmail.com'));
});
