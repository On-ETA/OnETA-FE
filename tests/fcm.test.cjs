const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const babel = require("@babel/core");

function load(file, mocks = {}, globals = {}) {
  const filename = path.resolve(__dirname, "..", file);
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-typescript", "@babel/plugin-transform-modules-commonjs"],
  });
  const exports = {};
  vm.runInNewContext(code, {
    exports, AbortController, setTimeout, clearTimeout,
    console: { warn() {} }, process: { env: {} },
    require(name) {
      if (!(name in mocks)) throw new Error(`Unexpected dependency: ${name}`);
      return mocks[name];
    },
    ...globals,
  }, { filename });
  return exports;
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function registrationFixture(send = async () => {}) {
  const auth = load("src/api/auth/tokens.js");
  const registration = load("src/notifications/deviceTokenRegistration.js", {
    "../api/auth/tokens": auth,
    "../api/notifications/fcmApi": { registerFcmToken: send },
  });
  return { auth, registration };
}

test("registration waits for login and coalesces repeated token requests", async () => {
  const response = deferred();
  let calls = 0;
  const { auth, registration: r } = registrationFixture(() => { calls++; return response.promise; });
  r.setSavedDeviceToken("fcm-1");
  assert.equal((await r.registerSavedDeviceToken()).skipped, true);
  auth.setAuthTokens({ accessToken: "account-a" });
  const first = r.registerSavedDeviceToken();
  const second = r.registerSavedDeviceToken();
  assert.equal(calls, 1);
  response.resolve();
  await Promise.all([first, second]);
  assert.equal((await r.registerSavedDeviceToken()).skipped, true);
  auth.setAuthTokens({ accessToken: "renewed-a" }, { isRefresh: true });
  await r.registerSavedDeviceToken();
  assert.equal(calls, 1);
  auth.setAuthTokens({ accessToken: "account-b" });
  await r.registerSavedDeviceToken();
  assert.equal(calls, 2);
});

test("failed registrations and refreshed FCM tokens can be sent again", async () => {
  let calls = 0;
  const { auth, registration: r } = registrationFixture(async () => {
    if (++calls === 1) throw new Error("offline");
  });
  auth.setAuthTokens({ accessToken: "account-a" });
  r.setSavedDeviceToken("fcm-1");
  await assert.rejects(r.registerSavedDeviceToken(), /offline/);
  await r.registerSavedDeviceToken();
  r.setSavedDeviceToken("fcm-2");
  await r.registerSavedDeviceToken();
  assert.equal(calls, 3);
});

test("an old registration cannot mark a new session as registered", async () => {
  const response = deferred();
  const { auth, registration: r } = registrationFixture(() => response.promise);
  auth.setAuthTokens({ accessToken: "account-a" });
  r.setSavedDeviceToken("fcm-1");
  const request = r.registerSavedDeviceToken();
  auth.clearAuthTokens();
  response.resolve();
  assert.equal((await request).skipped, true);
});

function lifecycleFixture({ permission = true, send = async () => {}, initial = null } = {}) {
  const calls = { tokens: 0, permissions: [], sends: [], deleted: 0, invalidations: 0, ends: 0 };
  const { auth, registration } = registrationFixture(async (options) => {
    calls.sends.push(options);
    return send(options);
  });
  let token = "fcm-1";
  const handlers = {};
  const listen = (key) => (callback) => {
    handlers[key] = callback;
    return () => delete handlers[key];
  };
  const appState = {
    currentState: "active",
    addEventListener: (_, fn) => {
      handlers.state = fn;
      return { remove: () => delete handlers.state };
    },
  };
  const fcm = {
    supportsFcm: true,
    requestNotificationPermission: async (prompt) => { calls.permissions.push(prompt); return permission; },
    getFcmToken: async () => { calls.tokens++; return token; },
    deleteFcmToken: async () => { calls.deleted++; token = "fcm-new-session"; },
    getInitialFcmNotification: async () => initial,
    listenForegroundMessage: listen("message"),
    listenNotificationOpen: listen("open"),
    listenTokenRefresh: listen("token"),
  };
  const timers = new Map();
  let timerId = 0;
  const lifecycle = load("src/notifications/lifecycle.js", {
    "react-native": { AppState: appState },
    "../api/auth/tokens": auth,
    "../service/fcm": fcm,
    "./deviceTokenRegistration": registration,
    "./events": { invalidateNotifications: () => calls.invalidations++ },
  }, {
    setTimeout: (fn, delay) => { timers.set(++timerId, { fn, delay }); return timerId; },
    clearTimeout: (id) => timers.delete(id),
  });
  const foreground = [], opens = [];
  const start = () => lifecycle.startFcm({
    onForegroundMessage: (message) => foreground.push(message),
    onNotificationOpen: (message) => opens.push(message),
    onSessionEnd: () => calls.ends++,
  });
  async function next() {
    const entry = timers.entries().next().value;
    assert.ok(entry, "expected scheduled work");
    timers.delete(entry[0]);
    return entry[1].fn();
  }
  return { auth, calls, handlers, timers, foreground, opens, start, next, appState,
    setToken: (value) => { token = value; }, fcm };
}

test("startup yields rendering, then login and token refresh register without duplicate POSTs", async () => {
  const f = lifecycleFixture();
  const stop = f.start();
  assert.equal(f.calls.tokens, 0);
  assert.equal([...f.timers.values()][0].delay, 500);
  await f.next();
  assert.equal(f.calls.sends.length, 0);
  f.auth.setAuthTokens({ accessToken: "account-a" });
  await f.next();
  assert.equal(f.calls.sends.length, 1);
  f.handlers.state("active");
  await f.next();
  assert.equal(f.calls.sends.length, 1);
  f.auth.setAuthTokens({ accessToken: "renewed-a" }, { isRefresh: true });
  assert.equal(f.timers.size, 0);
  f.setToken("fcm-2");
  f.handlers.token("fcm-2");
  await f.next();
  assert.equal(f.calls.sends[1].deviceToken, "fcm-2");
  stop();
  assert.equal(f.timers.size, 0);
  assert.equal(Object.keys(f.handlers).length, 0);
});

test("permission denial does not fetch or register a token", async () => {
  const f = lifecycleFixture({ permission: false });
  f.auth.setAuthTokens({ accessToken: "account-a" });
  const stop = f.start();
  await f.next();
  f.handlers.state("active");
  await f.next();
  assert.deepEqual(f.calls.permissions, [true, false]);
  assert.equal(f.calls.tokens, 0);
  assert.equal(f.calls.sends.length, 0);
  stop();
});

test("registration retries use capped backoff and restart on foreground", async () => {
  const f = lifecycleFixture({ send: async () => { throw new Error("offline"); } });
  f.auth.setAuthTokens({ accessToken: "account-a" });
  const stop = f.start();
  for (let attempt = 0; attempt < 4; attempt++) {
    await f.next();
    if (attempt < 3) assert.ok([...f.timers.values()][0].delay >= 1000 * 2 ** attempt);
  }
  assert.equal(f.timers.size, 0);
  assert.equal(f.calls.sends.length, 4);
  f.handlers.state("active");
  await f.next();
  assert.equal(f.calls.sends.length, 5);
  stop();
});

test("foreground and open events deduplicate separately; messages do not show after logout", async () => {
  const message = { messageId: "same-message", notification: { title: "Arrival" } };
  const f = lifecycleFixture({ initial: message });
  f.auth.setAuthTokens({ accessToken: "account-a" });
  const stop = f.start();
  await f.next();
  f.handlers.message(message);
  f.handlers.message(message);
  f.handlers.open(message);
  assert.equal(f.foreground.length, 1);
  assert.equal(f.opens.length, 1);
  f.auth.clearAuthTokens();
  f.handlers.message({ messageId: "signed-out" });
  assert.equal(f.foreground.length, 1);
  assert.equal(f.calls.ends, 1);
  await f.next();
  assert.equal(f.calls.deleted, 1);
  stop();
});

test("logout cancels a pending registration and the next account gets a new token", async () => {
  const response = deferred();
  const f = lifecycleFixture({ send: () => response.promise });
  f.auth.setAuthTokens({ accessToken: "account-a" });
  const stop = f.start();
  const syncing = f.next();
  await new Promise(setImmediate);
  assert.equal(f.calls.sends.length, 1);
  f.auth.clearAuthTokens();
  f.auth.setAuthTokens({ accessToken: "account-b" });
  assert.equal(f.calls.sends[0].signal.aborted, true);
  response.resolve();
  await syncing;
  await f.next();
  assert.equal(f.calls.sends[1].accessToken, "account-b");
  assert.equal(f.calls.sends[1].deviceToken, "fcm-new-session");
  stop();
});

test("a reissue response arriving after logout cannot restore auth", async () => {
  const response = deferred();
  const auth = load("src/api/auth/tokens.js");
  auth.setAuthTokens({ accessToken: "a", refreshToken: "refresh-a" });
  const { reissueAuthTokens } = load("src/api/auth/reissue.js", {
    "./tokens": auth, "../client": { requestJson: () => response.promise },
  });
  const reissuing = reissueAuthTokens();
  auth.clearAuthTokens();
  response.resolve({ data: { accessToken: "renewed-a", refreshToken: "renewed-refresh-a" } });
  await assert.rejects(reissuing, (error) => error.name === "AbortError");
  assert.equal(auth.getAccessToken(), null);
});

test("requests respect an already-aborted signal and preserve AbortError", async () => {
  const { requestJson } = load("src/api/client.js", {}, {
    fetch: async (_, options) => {
      assert.equal(options.signal.aborted, true);
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    },
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(requestJson({ path: "/test", signal: controller.signal }),
    (error) => error.name === "AbortError");
});

test("background handler persists receipt metadata, not notification contents", async () => {
  let handler, stored;
  const fcm = load("src/service/fcm.ts", {
    "react-native": { Platform: { OS: "android" } },
    "@react-native-firebase/messaging": {
      getMessaging: () => ({}),
      setBackgroundMessageHandler: (_, callback) => { handler = callback; },
    },
    "@react-native-async-storage/async-storage": {
      setItem: async (key, value) => { stored = { key, value: JSON.parse(value) }; },
    },
  });
  fcm.registerBackgroundFcmHandler();
  await handler({ messageId: "background-1", notification: { title: "private" } });
  assert.equal(stored.value.messageId, "background-1");
  assert.equal(typeof stored.value.receivedAt, "number");
  assert.equal(JSON.stringify(stored).includes("private"), false);
});

test("notification navigation waits for navigation readiness and authenticated home", () => {
  let ready = false, accessToken = null, current = "Login";
  const navigated = [];
  const ref = { isReady: () => ready, getCurrentRoute: () => ({ name: current }),
    navigate: (route) => navigated.push(route) };
  const nav = load("src/notifications/navigation.js", {
    "@react-navigation/native": { createNavigationContainerRef: () => ref },
    "../api/auth/tokens": { getAccessToken: () => accessToken },
    "../navigation/routes": { routes: { login: "Login", notifications: "Notifications" } },
  });
  nav.openNotificationInbox();
  ready = true;
  nav.flushNotificationNavigation();
  accessToken = "a";
  nav.flushNotificationNavigation();
  assert.equal(navigated.length, 0);
  current = "Home";
  nav.flushNotificationNavigation();
  nav.flushNotificationNavigation();
  assert.deepEqual(navigated, ["Notifications"]);
});

test("web FCM adapter never imports a native Firebase module", async () => {
  const fcm = load("src/service/fcm.web.ts");
  assert.equal(fcm.supportsFcm, false);
  assert.equal(await fcm.getFcmToken(), null);
  fcm.registerBackgroundFcmHandler();
});

test("FCM API preserves the backend device-token contract", async () => {
  let request;
  const auth = load("src/api/auth/tokens.js");
  const deviceTokens = load("src/api/notifications/deviceTokens.js", {
    "../auth/tokens": auth,
    "../auth/reissue": { reissueAuthTokens: async () => { throw new Error("unexpected refresh"); } },
    "../client": { requestJson: async (options) => { request = options; return { code: "SUCCESS" }; } },
  });
  const api = load("src/api/notifications/fcmApi.ts", { "./deviceTokens": deviceTokens });
  await api.registerFcmToken({ deviceToken: "fcm-1", accessToken: "account-a" });
  assert.equal(request.method, "POST");
  assert.equal(request.path, "/api/notifications/device-tokens");
  assert.equal(request.accessToken, "account-a");
  assert.equal(JSON.stringify(request.body), '{"deviceToken":"fcm-1"}');
});

test("a stale device registration cannot refresh another account's credentials", async () => {
  const response = deferred();
  const auth = load("src/api/auth/tokens.js");
  auth.setAuthTokens({ accessToken: "account-a" });
  let refreshes = 0;
  const { registerDeviceToken } = load("src/api/notifications/deviceTokens.js", {
    "../auth/tokens": auth,
    "../auth/reissue": { reissueAuthTokens: async () => { refreshes++; } },
    "../client": { requestJson: () => response.promise },
  });
  const registering = registerDeviceToken({ deviceToken: "fcm-1" });
  auth.setAuthTokens({ accessToken: "account-b" });
  response.reject(Object.assign(new Error("unauthorized"), { status: 401 }));
  await assert.rejects(registering, /unauthorized/);
  assert.equal(refreshes, 0);
});

test("Android 13 permission uses POST_NOTIFICATIONS and does not reprompt on resume", async () => {
  let prompts = 0;
  const fcm = load("src/service/fcm.ts", {
    "react-native": {
      Platform: { OS: "android", Version: 33 },
      PermissionsAndroid: {
        PERMISSIONS: { POST_NOTIFICATIONS: "android.permission.POST_NOTIFICATIONS" },
        RESULTS: { GRANTED: "granted" },
        check: async () => false,
        request: async (permission) => { assert.equal(permission, "android.permission.POST_NOTIFICATIONS"); prompts++; return "granted"; },
      },
    },
    "@react-native-firebase/messaging": {},
    "@react-native-async-storage/async-storage": {},
  });
  assert.equal(await fcm.requestNotificationPermission(), true);
  assert.equal(await fcm.requestNotificationPermission(false), false);
  assert.equal(prompts, 1);
});

test("iOS accepts provisional permission and waits for APNs registration before FCM token", async () => {
  const order = [];
  const fcm = load("src/service/fcm.ts", {
    "react-native": { Platform: { OS: "ios" } },
    "@react-native-firebase/messaging": {
      AuthorizationStatus: { NOT_DETERMINED: -1, AUTHORIZED: 1, PROVISIONAL: 2 },
      getMessaging: () => ({}), hasPermission: async () => 2,
      isDeviceRegisteredForRemoteMessages: () => false,
      registerDeviceForRemoteMessages: async () => order.push("apns"),
      getToken: async () => { order.push("fcm"); return "fcm-ios"; },
    },
    "@react-native-async-storage/async-storage": {},
  });
  assert.equal(await fcm.requestNotificationPermission(), true);
  assert.equal(await fcm.getFcmToken(), "fcm-ios");
  assert.deepEqual(order, ["apns", "fcm"]);
});
