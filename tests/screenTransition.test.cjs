const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { test } = require('node:test');
const babel = require('@babel/core');

function fixture({ reduced = false, deferred = false, platform = "android" } = {}) {
  const componentSlots = [], routeSlots = [];
  let slots = componentSlots;
  const effects = [];
  const starts = [];
  let preferenceReads = 0;
  let cursor = 0, focused = true, changeMotion, resolveMotion;
  let navigationState = { index: 0, routes: [{ key: "home" }] };
  const motion = deferred ? new Promise(resolve => { resolveMotion = resolve; }) : Promise.resolve(reduced);
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect(callback, deps) {
      const index = cursor++, prior = slots[index];
      if (!prior || deps.some((dep, i) => !Object.is(dep, prior.deps[i]))) {
        slots[index] = { deps, cleanup: prior?.cleanup };
        effects.push(() => { slots[index].cleanup?.(); slots[index].cleanup = callback(); });
      }
    },
  };
  class Value { constructor(value) { this.value = value; } setValue(value) { this.value = value; } stopAnimation() {} interpolate(config) { return config; } }
  const mocks = {
    react,
    '@react-navigation/native': { useIsFocused: () => focused, useNavigationState: selector => selector(navigationState) },
    'react-native': {
      View: 'View', Platform: { OS: platform }, StyleSheet: { create: styles => styles },
      Easing: { cubic: 'cubic', out: value => value },
      Animated: { Value, View: 'AnimatedView', timing: (value, config) => ({ start: () => starts.push({ value, config }), stop: () => { value.setValue(1); } }) },
      AccessibilityInfo: {
        isReduceMotionEnabled: () => { preferenceReads++; return motion; },
        addEventListener: (_, handler) => { changeMotion = handler; return { remove() {} }; },
      },
    },
  };
  const exports = {};
  const { code } = babel.transformSync(fs.readFileSync(path.join(__dirname, '../src/components/ScreenTransition.js'), 'utf8'), {
    configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs', '@babel/plugin-transform-react-jsx'],
  });
  vm.runInNewContext(code, { exports, require: name => mocks[name] });
  return {
    preferenceReads: () => preferenceReads,
    starts, changeMotion: value => changeMotion(value), resolveMotion: value => resolveMotion(value),
    focus: value => { focused = value; },
    navigation: value => { navigationState = value; },
    render(props = {}) {
      cursor = 0;
      const tree = exports.ScreenTransition(props);
      effects.splice(0).forEach(effect => effect());
      return tree;
    },
    renderRoute() {
      slots = routeSlots; cursor = 0;
      const props = exports.NavigationScreenTransition({ children: 'page' }).props;
      slots = componentSlots;
      return this.render(props);
    },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}
const settle = () => new Promise(setImmediate);

test('routes animate on entry and focus return, but ordinary screen updates do not restart the transition', async () => {
  const f = fixture();
  f.renderRoute(); await settle(); assert.equal(f.starts.length, 1);
  f.renderRoute(); await settle(); assert.equal(f.starts.length, 1);
  f.focus(false); f.renderRoute(); await settle(); assert.equal(f.starts.length, 1);
  f.focus(true); f.renderRoute(); await settle(); assert.equal(f.starts.length, 2);
});

test('internal pages animate when the step changes without animating their initial mount', async () => {
  const f = fixture();
  f.render({ transitionKey: 'list', animateOnMount: false }); await settle(); assert.equal(f.starts.length, 0);
  f.render({ transitionKey: 'search', animateOnMount: false }); await settle(); assert.equal(f.starts.length, 1);
  f.render({ transitionKey: 'search', animateOnMount: false }); await settle(); assert.equal(f.starts.length, 1);
  f.render({ transitionKey: 'list', animateOnMount: false }); await settle(); assert.equal(f.starts.length, 2);
});

test('reduced motion skips animations and enabling it during a transition restores the visible screen', async () => {
  const reduced = fixture({ reduced: true });
  reduced.render(); await settle(); assert.equal(reduced.starts.length, 0);
  const f = fixture(); f.render(); await settle();
  f.changeMotion(true); assert.equal(f.starts[0].value.value, 1);
});

test('a screen closed before the accessibility check resolves never starts a late animation', async () => {
  const f = fixture({ deferred: true }); f.render(); f.unmount(); f.resolveMotion(false); await settle();
  assert.equal(f.starts.length, 0);
});

function horizontalStart(tree) {
  return tree.props.children[0].props.style[1].transform[0].translateX.outputRange[0];
}

test('home tab content moves left for first-last to custom alarms and right for the reverse switch', async () => {
  const f = fixture();
  f.render({ transitionKey: 'firstLast', direction: 'backward', animateOnMount: false });
  const next = f.render({ transitionKey: 'customAlarm', direction: 'forward', animateOnMount: false });
  await settle(); assert.ok(horizontalStart(next) > 0);
  const back = f.render({ transitionKey: 'firstLast', direction: 'backward', animateOnMount: false });
  await settle(); assert.ok(horizontalStart(back) < 0);
  assert.equal(f.starts.length, 2);
});

test('web navigation returning to a previous stack screen slides right instead of repeating the forward slide', async () => {
  const f = fixture();
  assert.ok(horizontalStart(f.renderRoute()) > 0); await settle();
  f.navigation({ index: 1, routes: [{ key: 'home' }, { key: 'myPage' }] });
  f.focus(false); f.renderRoute(); await settle();
  f.navigation({ index: 0, routes: [{ key: 'home' }] });
  f.focus(true); const back = f.renderRoute(); await settle();
  assert.ok(horizontalStart(back) < 0); assert.equal(f.starts.length, 2);
  f.navigation({ index: 1, routes: [{ key: 'home' }, { key: 'detail' }] });
  assert.ok(horizontalStart(f.renderRoute()) > 0);
});

test('internal next steps slide left and returning to a shallower screen slides right', async () => {
  const f = fixture();
  f.render({ transitionKey: 'home', transitionDepth: 0, animateOnMount: false });
  const next = f.render({ transitionKey: 'myPage', transitionDepth: 1, animateOnMount: false });
  await settle(); assert.ok(horizontalStart(next) > 0);
  const back = f.render({ transitionKey: 'home', transitionDepth: 0, animateOnMount: false });
  await settle(); assert.ok(horizontalStart(back) < 0);
  f.render({ transitionKey: 'home', transitionDepth: 0, animateOnMount: false }); await settle();
  assert.equal(f.starts.length, 2);
});


test('home header and tab buttons stay outside the animated content on both home tabs', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/screens/HomeScreen.js'), 'utf8');
  const ast = babel.parseSync(source, { configFile: false, babelrc: false, parserOpts: { plugins: ['jsx'] } });
  const dashboard = ast.program.body.find(node => node.type === 'VariableDeclaration' && node.declarations.some(value => value.id.name === 'HomeDashboard'));
  const { code } = babel.transformSync(source.slice(dashboard.start, dashboard.end) + '\nexports.HomeDashboard = HomeDashboard;', {
    configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-react-jsx'],
  });
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    React: { memo: component => component, createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) },
    HomeTopSection: 'header', ScreenTransition: 'transition', CustomAlarmScreen: 'customAlarm', FirstLastRouteScreen: 'firstLast',
  });
  for (const activeHomeTab of ['firstLast', 'customAlarm']) {
    const tree = exports.HomeDashboard({ activeHomeTab });
    const [header, content] = tree.props.children;
    assert.equal(header.type, 'header'); assert.equal(header.props.activeTab, activeHomeTab);
    assert.equal(content.type, 'transition'); assert.equal(content.props.children[0].type, activeHomeTab);
    assert.equal(content.props.direction, activeHomeTab === 'customAlarm' ? 'forward' : 'backward');
  }
});


test('later screen transitions start immediately from the shared accessibility preference without another async lookup', async () => {
  const f = fixture(); f.render({ transitionKey: 'first' }); await settle();
  assert.equal(f.preferenceReads(), 1); assert.equal(f.starts.length, 1);
  f.render({ transitionKey: 'next' });
  assert.equal(f.starts.length, 2); assert.equal(f.preferenceReads(), 1);
});

test('web uses CSS animations in both directions without driving Animated frames in JavaScript', async () => {
  const f = fixture({ platform: 'web' });
  f.render({ transitionKey: 'home', animateOnMount: false });
  f.render({ transitionKey: 'next', direction: 'forward', animateOnMount: false }); await settle();
  const next = f.render({ transitionKey: 'next', direction: 'forward', animateOnMount: false });
  const frames = next.props.children[0].props.style[2].animationKeyframes;
  assert.equal(frames.from.transform, 'translateX(24px)'); assert.equal(f.starts.length, 0);
  f.render({ transitionKey: 'home', direction: 'backward', animateOnMount: false });
  const back = f.render({ transitionKey: 'home', direction: 'backward', animateOnMount: false });
  assert.equal(back.props.children[0].props.style[2].animationKeyframes['0%'].transform, 'translateX(-24px)');
  f.changeMotion(true);
  const stopped = f.render({ transitionKey: 'home', direction: 'backward', animateOnMount: false });
  assert.equal(stopped.props.children[0].props.style[2], null);
});


test('the actual web renderer emits valid directional transforms for all CSS transition variants', () => {
  const rn = require('react-native-web'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
  const source = fs.readFileSync(path.join(__dirname, '../src/components/ScreenTransition.js'), 'utf8');
  const { code } = babel.transformSync(source, {
    configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs', '@babel/plugin-transform-react-jsx'],
  });
  const exports = {};
  vm.runInNewContext(code + '\nexports.stylesForCheck = styles;', {
    exports, require: name => name === 'react-native' ? rn : name === 'react' ? React : {},
  });
  for (const direction of ['forwardA', 'forwardB', 'backwardA', 'backwardB']) {
    renderToStaticMarkup(React.createElement(rn.View, { style: [exports.stylesForCheck.webAnimation, exports.stylesForCheck[direction]] }));
  }
  const css = rn.StyleSheet.getSheet().textContent;
  assert.ok(css.includes('@keyframes')); assert.ok(css.includes('translateX(-24px)')); assert.ok(css.includes('translateX(24px)'));
  assert.ok(!css.includes('transform:[object Object]'));
});
