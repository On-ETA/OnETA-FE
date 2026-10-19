const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const babel = require("@babel/core");
const { test } = require("node:test");

function loadLinking() {
  const { code } = babel.transformSync(fs.readFileSync("linking.js", "utf8"), {
    configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-modules-commonjs"],
  });
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => name === "@react-navigation/native"
    ? { getStateFromPath: (path, options) => ({ path, options }) }
    : { routes: { welcome: "Welcome", login: "Login", home: "Home", signup: "Signup", oauthCallback: "OAuthCallback" } },
  });
  return exports;
}

function startup({ completed = true } = {}) {
  const slots = [], effects = [], timers = new Map();
  const writes = [];
  let cursor = 0, resolveAuth, rejectAuth;
  const hydration = new Promise((resolve, reject) => {
    resolveAuth = resolve;
    rejectAuth = reject;
  });
  const react = {
    useMemo: callback => callback(),
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { value: initial };
      return [slots[index].value, value => { slots[index].value = value; }];
    },
    useEffect(effect) {
      const index = cursor++;
      if (!(index in slots)) {
        slots[index] = {};
        effects.push(() => { slots[index].cleanup = effect(); });
      }
    },
  };
  const mocks = {
    react,
    "@react-navigation/native": { NavigationContainer: "NavigationContainer" },
    "@react-navigation/native-stack": {
      createNativeStackNavigator: () => ({ Navigator: "Navigator", Screen: "Screen" }),
    },
    "react-native": { Platform: { OS: "web" } },
    "react-native-safe-area-context": { SafeAreaProvider: "SafeAreaProvider" },
    "./src/screens": { OnboardingScreen: "OnboardingScreen", OnboardingIntroScreen: "OnboardingIntroScreen", WelcomeScreen: "WelcomeScreen" },
    "@react-native-async-storage/async-storage": {
      getItem: () => Promise.resolve(completed ? "true" : null),
      setItem: (key, value) => { writes.push([key, value]); return Promise.resolve(); },
    },
    "./src/navigation/routes": { routes: { welcome: "Welcome", login: "Login", signup: "Signup", home: "Home" } },
    "./src/api/auth/tokens": { hydrateAuthTokens: () => hydration },
    "./src/components/ScreenTransition": { initializeScreenTransitions() {} },
    "./src/utils/accessibility": { blurActiveElement() {} },
    "./linking": loadLinking(),
  };
  const { code } = babel.transformSync(fs.readFileSync("App.js", "utf8"), {
    configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-modules-commonjs", "@babel/plugin-transform-react-jsx"],
  });
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: name => mocks[name] ?? {},
    setTimeout(callback, delay) { const timer = { callback, delay }; timers.set(timer, timer); return timer; },
    clearTimeout: timer => timers.delete(timer),
  });
  return {
    render() { cursor = 0; return exports.default(); },
    flush() { effects.splice(0).forEach(effect => effect()); },
    finishDelay() {
      for (const [key, timer] of timers) {
        assert.equal(timer.delay, 1500);
        timers.delete(key);
        timer.callback();
      }
    },
    resolveAuth, rejectAuth, timers, writes,
    unmount() { slots.forEach(slot => slot.cleanup?.()); },
  };
}

function find(tree, type) {
  if (!tree || typeof tree !== "object") return undefined;
  if (tree.type === type) return tree;
  return (tree.children ?? []).map(child => find(child, type)).find(Boolean);
}

for (const accessToken of [null, "saved-session"]) {
  test(`completed onboarding opens ${accessToken ? "home" : "login"} without showing a logo or waiting for its timer`, async () => {
    const app = startup();
    assert.equal(app.render(), null);
    app.flush();
    app.resolveAuth({ accessToken });
    await new Promise(setImmediate);
    const tree = app.render();
    assert.equal(find(tree, "OnboardingScreen"), undefined);
    assert.equal(find(tree, "OnboardingIntroScreen"), undefined);
    assert.equal(find(tree, "Navigator").props.initialRouteName, accessToken ? "Home" : "Login");
    assert.equal(find(tree, "NavigationContainer").props.linking.getStateFromPath("/").routes[0].name, accessToken ? "Home" : "Login");
    app.unmount();
  });
}

test("returning startup stays blank during session restoration and opens login if it fails", async () => {
  const app = startup();
  app.render(); app.flush(); app.finishDelay();
  await new Promise(setImmediate);
  assert.equal(app.render(), null);
  app.rejectAuth(new Error("Storage unavailable"));
  await new Promise(setImmediate);
  assert.equal(find(app.render(), "Navigator").props.initialRouteName, "Login");
  app.unmount();
});

test("unmounting startup cancels its display timer", () => {
  const app = startup();
  app.render(); app.flush();
  assert.equal(app.timers.size, 1);
  app.unmount();
  assert.equal(app.timers.size, 0);
});

test("startup waits for session restoration before deciding whether to show the first logo", async () => {
  const app = startup({ completed: false });
  app.render(); app.flush();
  await new Promise(setImmediate);
  assert.equal(app.render(), null);
  app.resolveAuth({ accessToken: null });
  await new Promise(setImmediate);
  assert.ok(find(app.render(), "OnboardingScreen"));
  app.unmount();
});

test("first launch advances through all three introductions and only then remembers completion", async () => {
  const app = startup({ completed: false });
  app.render(); app.flush();
  app.resolveAuth({ accessToken: null });
  await new Promise(setImmediate);
  assert.ok(find(app.render(), "OnboardingScreen"));
  app.finishDelay();
  const intro = find(app.render(), "OnboardingIntroScreen");
  assert.ok(intro);
  assert.equal(intro.props.step, 0);
  intro.props.onNextPress();
  const departure = find(app.render(), "OnboardingIntroScreen");
  assert.equal(departure.props.step, 1);
  assert.deepEqual(app.writes, []);
  departure.props.onBackPress();
  const returned = find(app.render(), "OnboardingIntroScreen");
  assert.equal(returned.props.step, 0);
  returned.props.onNextPress();
  find(app.render(), "OnboardingIntroScreen").props.onNextPress();
  const schedule = find(app.render(), "OnboardingIntroScreen");
  assert.equal(schedule.props.step, 2);
  assert.deepEqual(app.writes, []);
  schedule.props.onBackPress();
  const previous = find(app.render(), "OnboardingIntroScreen");
  assert.equal(previous.props.step, 1);
  previous.props.onNextPress();
  find(app.render(), "OnboardingIntroScreen").props.onNextPress();
  assert.equal(find(app.render(), "Navigator").props.initialRouteName, "Welcome");
  assert.deepEqual(app.writes, [["oneta.onboardingComplete", "true"]]);
  app.unmount();
});

test("an existing authenticated session without a completion flag skips the logo and remembers completion", async () => {
  const app = startup({ completed: false });
  app.render(); app.flush();
  app.resolveAuth({ accessToken: "saved-session" });
  await new Promise(setImmediate);
  const tree = app.render();
  assert.equal(find(tree, "OnboardingScreen"), undefined);
  assert.equal(find(tree, "OnboardingIntroScreen"), undefined);
  assert.equal(find(tree, "Navigator").props.initialRouteName, "Home");
  assert.deepEqual(app.writes, [["oneta.onboardingComplete", "true"]]);
  app.unmount();
});

test("returning users skip Welcome, while its signup and login actions remain available on first launch", async () => {
  const app = startup({ completed: true });
  app.render(); app.flush();
  app.resolveAuth({ accessToken: null });
  await new Promise(setImmediate);
  app.finishDelay();
  const tree = app.render();
  assert.equal(find(tree, "OnboardingIntroScreen"), undefined);
  assert.equal(find(tree, "Navigator").props.initialRouteName, "Login");
  const welcomeRoute = find(tree, "Screen");
  assert.equal(welcomeRoute.props.name, "Welcome");
  const destinations = [];
  const welcome = welcomeRoute.props.component({ navigation: { navigate: name => destinations.push(name) } });
  welcome.props.onSignupPress();
  welcome.props.onLoginPress();
  assert.deepEqual(destinations, ["Signup", "Login"]);
  assert.deepEqual(app.writes, []);
  app.unmount();
});

test("root URLs follow the startup destination while explicit authentication links keep their paths", () => {
  for (const destination of ["Login", "Home", "Welcome"]) {
    const linking = loadLinking().createAppLinking(destination);
    for (const path of ["", "/", "/?source=app"]) {
      assert.equal(linking.getStateFromPath(path).routes[0].name, destination);
    }
    if (destination !== "Welcome") {
      assert.equal(linking.getStateFromPath("/welcome").routes[0].name, destination);
    }
    const options = { screens: linking.config.screens };
    for (const path of ["/signup", "/login", "/oauth/callback?code=test"]) {
      const state = linking.getStateFromPath(path, options);
      assert.equal(state.path, path);
      assert.equal(state.options, options);
    }
  }
});

test("all introduction pages use the shared transition, matching progress and working controls", () => {
  let backHandler;
  const mocks = {
    react: { createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }) },
    "react-native": {
      View: "View", Text: "Text", Pressable: "Pressable", ScrollView: "ScrollView",
      Platform: { select: options => options.web }, StyleSheet: { create: styles => styles },
      useWindowDimensions: () => ({ height: 812 }),
    },
    "expo-status-bar": { StatusBar: "StatusBar" },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView", useSafeAreaInsets: () => ({ top: 24, bottom: 24 }) },
    "./온보딩_1.svg": "RoutePreview",
    "./온보딩_2.svg": "DeparturePreview",
    "./온보딩_3.svg": "SchedulePreview",
    "../../components/ScreenTransition": { ScreenTransition: "ScreenTransition" },
    "../../hooks/useAndroidBackPress": { useAndroidBackPress: (handler, enabled) => { backHandler = enabled ? handler : null; } },
    "../../theme": { colors: {}, layout: {} },
  };
  const { code } = babel.transformSync(fs.readFileSync("src/screens/onboarding/OnboardingIntroScreen.js", "utf8"), {
    configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-modules-commonjs", "@babel/plugin-transform-react-jsx"],
  });
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => mocks[name] });
  let nextCount = 0, backCount = 0;
  const previews = ["RoutePreview", "DeparturePreview", "SchedulePreview"];
  const titles = ["첫차 막차 걱정 마세요", "버스 출발 시 알려드려요", "늦을까 시계 확인은 그만"];
  for (const step of [0, 1, 2]) {
    const tree = exports.OnboardingIntroScreen({ step, onNextPress: () => nextCount++, onBackPress: () => backCount++ });
    const transition = find(tree, "ScreenTransition");
    assert.equal(transition.props.transitionKey, step);
    assert.equal(transition.props.transitionDepth, step);
    assert.equal(transition.props.duration, 234);
    assert.ok(find(tree, previews[step]));
    assert.equal(find(tree, "Text").children[0], titles[step]);
    assert.equal(find(find(tree, "Pressable"), "Text").children[0], step === 2 ? "온에타 시작하기" : "다음");
    find(tree, "Pressable").props.onPress();
    if (step) assert.equal(backHandler(), true);
    else assert.equal(backHandler, null);
  }
  assert.equal(nextCount, 3);
  assert.equal(backCount, 2);
});
