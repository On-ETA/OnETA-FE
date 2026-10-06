const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const babel = require("@babel/core");

function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, "..", file);
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename,
    configFile: false,
    babelrc: false,
    plugins: ["@babel/plugin-transform-modules-commonjs"],
  });
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    AbortController,
    URLSearchParams,
    console,
    require(name) {
      if (!(name in mocks)) throw new Error(`Unexpected dependency: ${name}`);
      return mocks[name];
    },
  }, { filename });
  return exports;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function authFixture(requestJson) {
  const tokens = load("src/api/auth/tokens.js");
  const events = [];
  const reissue = load("src/api/auth/reissue.js", {
    "../client": { requestJson },
    "./authEvents": { notifyAuthRequired: (event) => events.push(event) },
    "./tokens": tokens,
  });
  return { tokens, events, reissue };
}

test("concurrent refresh calls share one request and keep the rotated token", async () => {
  const response = deferred();
  let requests = 0;
  const { tokens, reissue } = authFixture(() => {
    requests += 1;
    return response.promise;
  });
  await tokens.setAuthTokens({ accessToken: "old-access", refreshToken: "old-refresh" });

  const first = reissue.reissueAuthTokens();
  const second = reissue.reissueAuthTokens();
  assert.equal(requests, 1);
  response.resolve({ data: { accessToken: "new-access", refreshToken: "new-refresh" } });

  const results = await Promise.all([first, second]);
  assert.equal(results[0].accessToken, "new-access");
  assert.equal(results[1].refreshToken, "new-refresh");
  assert.deepEqual({ ...tokens.getAuthTokens() }, {
    accessToken: "new-access",
    refreshToken: "new-refresh",
  });
});

test("aborting one refresh waiter leaves the shared refresh running", async () => {
  const response = deferred();
  const { tokens, reissue } = authFixture(() => response.promise);
  await tokens.setAuthTokens({ accessToken: "old-access", refreshToken: "old-refresh" });
  const controller = new AbortController();

  const cancelled = reissue.reissueAuthTokens({ signal: controller.signal });
  const active = reissue.reissueAuthTokens();
  controller.abort();
  await assert.rejects(cancelled, (error) => error.name === "AbortError");

  response.resolve({ data: { accessToken: "new-access" } });
  assert.equal((await active).refreshToken, "old-refresh");
  assert.equal(tokens.getAuthTokens().accessToken, "new-access");
});

test("an already cancelled refresh does not start a request", async () => {
  let requests = 0;
  const { tokens, reissue } = authFixture(async () => {
    requests += 1;
  });
  await tokens.setAuthTokens({ accessToken: "old-access", refreshToken: "old-refresh" });
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    reissue.reissueAuthTokens({ signal: controller.signal }),
    (error) => error.name === "AbortError",
  );
  assert.equal(requests, 0);
});

test("a refresh from an old login cannot replace a newer session", async () => {
  const response = deferred();
  const { tokens, reissue } = authFixture(() => response.promise);
  await tokens.setAuthTokens({ accessToken: "old-access", refreshToken: "old-refresh" });
  const pending = reissue.reissueAuthTokens();
  await tokens.setAuthTokens({ accessToken: "next-access", refreshToken: "next-refresh" });
  response.resolve({ data: { accessToken: "stale-access", refreshToken: "stale-refresh" } });

  await assert.rejects(pending, (error) => error.name === "AbortError");
  assert.equal(tokens.getAuthTokens().accessToken, "next-access");
});

test("transit notifications use fresh cache and refetch expired entries", async () => {
  const cache = new Map();
  let requests = 0;
  const transit = load("src/api/notifications/transit.js", {
    "../auth/tokens": { getAccessToken: () => "access" },
    "../auth/reissue": { reissueAuthTokens: async () => ({ accessToken: "new-access" }) },
    "../client": {
      requestJson: async () => {
        requests += 1;
        return { data: [{ notificationId: requests, routeDetails: "{}", scheduleType: "FIRST_TRANSIT" }] };
      },
    },
    "../homeCache": {
      homeCacheKeys: {
        firstTransitNotifications: "first",
        lastTransitNotifications: "last",
      },
      readHomeCacheAsync: async (key) => cache.get(key),
      writeHomeCacheAsync: async (key, value) => cache.set(key, value),
    },
  });

  await transit.getTransitNotifications();
  assert.equal(requests, 1);
  await transit.getTransitNotifications();
  assert.equal(requests, 1);

  cache.get("first").savedAt = Date.now() - 4 * 60_000;
  await transit.getTransitNotifications();
  assert.equal(requests, 1);
  cache.get("first").savedAt = Date.now() - 6 * 60_000;
  const refreshed = await transit.getTransitNotifications();
  assert.equal(requests, 2);
  assert.equal(refreshed[0].notificationId, 2);
});

test("first and last transit lists keep only their own schedule type", async () => {
  const cache = new Map();
  const requests = [];
  const transit = load("src/api/notifications/transit.js", {
    "../auth/tokens": { getAccessToken: () => "access" },
    "../auth/reissue": { reissueAuthTokens: async () => ({ accessToken: "next" }) },
    "../client": {
      requestJson: async ({ path }) => {
        requests.push(path);
        return {
          data: [
            { notificationId: 1, scheduleType: "FIRST_TRANSIT", routeDetails: "{}" },
            { notificationId: 2, scheduleType: "LAST_TRANSIT", routeDetails: "{}" },
          ],
        };
      },
    },
    "../homeCache": {
      homeCacheKeys: {
        firstTransitNotifications: "first",
        lastTransitNotifications: "last",
      },
      readHomeCacheAsync: async (key) => cache.get(key),
      writeHomeCacheAsync: async (key, value) => cache.set(key, value),
    },
  });

  const first = await transit.getTransitNotifications({ scheduleType: "FIRST_TRANSIT" });
  const last = await transit.getTransitNotifications({ scheduleType: "LAST_TRANSIT" });
  assert.deepEqual(first.map((item) => item.notificationId), [1]);
  assert.deepEqual(last.map((item) => item.notificationId), [2]);
  assert.equal(cache.get("first").notifications[0].scheduleType, "FIRST_TRANSIT");
  assert.equal(cache.get("last").notifications[0].scheduleType, "LAST_TRANSIT");
  assert.ok(requests[0].includes("scheduleType=FIRST_TRANSIT"));
  assert.ok(requests[1].includes("scheduleType=LAST_TRANSIT"));
});

test("cancelled home preload drains old requests before a new preload starts", async () => {
  let addressRequests = 0;
  let aborted = false;
  const preload = load("src/api/homePreload.js", {
    "./addresses": {
      getAddresses: ({ signal }) => {
        addressRequests += 1;
        if (addressRequests > 1) return Promise.resolve([]);
        return new Promise((resolve, reject) => {
          signal.addEventListener("abort", () => {
            aborted = true;
            const error = new Error("Request aborted");
            error.name = "AbortError";
            reject(error);
          }, { once: true });
        });
      },
    },
    "./mypage": { getMyPage: async () => ({}) },
    "./notifications/arrival": { getArrivalNotifications: async () => [] },
    "./notifications/depot": { getMyDepotNotifications: async () => [] },
    "./notifications/transit": {
      getTransitNotifications: async () => [],
      TRANSIT_SCHEDULE_TYPES: { first: "FIRST_TRANSIT", last: "LAST_TRANSIT" },
    },
    "./homeCache": {
      homeCacheKeys: {
        addresses: "addresses",
        scheduleNotifications: "schedule",
        firstTransitNotifications: "first",
        lastTransitNotifications: "last",
        depotNotifications: "depot",
        myPage: "myPage",
        firstLastRoute: "route",
      },
      readHomeCache: () => null,
      readHomeCacheAsync: async (_, fallback) => fallback,
      clearHomeCacheAsync: async () => {},
    },
  });

  const oldPreload = preload.preloadHomeCache();
  await new Promise((resolve) => setImmediate(resolve));
  await preload.cancelHomePreload();
  await assert.rejects(oldPreload, (error) => error.name === "AbortError");
  assert.equal(aborted, true);

  await preload.preloadHomeCache();
  assert.equal(addressRequests, 2);
});

test("normal and first-last route searches send scheduleType to separate endpoints", async () => {
  const paths = [];
  const cache = new Map();
  const routes = load("src/api/transit/routes.js", {
    "../auth/tokens": { getAccessToken: () => "access" },
    "../auth/reissue": { reissueAuthTokens: async () => ({ accessToken: "next" }) },
    "../client": {
      requestJson: async ({ path }) => {
        paths.push(path);
        return { data: [{ routeId: paths.length, segments: [] }] };
      },
    },
    "../homeCache": {
      homeCacheKeys: { transitRouteSearch: "route-search" },
      readHomeCacheAsync: async (key) => cache.get(key),
      writeHomeCacheAsync: async (key, value) => cache.set(key, value),
    },
  });
  const places = {
    originX: 126.891116,
    originY: 37.50866,
    destX: 126.922304,
    destY: 37.547766,
  };

  await routes.searchTransitRoutes({ ...places, scheduleType: "NORMAL" });
  await routes.searchFirstLastTransitRoutes({ ...places, scheduleType: "FIRST_TRANSIT" });
  await routes.searchFirstLastTransitRoutes({ ...places, scheduleType: "LAST_TRANSIT" });
  await routes.searchFirstLastTransitRoutes({ ...places, scheduleType: "FIRST_TRANSIT" });

  assert.equal(paths.length, 3);
  assert.ok(paths[0].startsWith("/api/transit/routes/search?"));
  assert.ok(paths[1].startsWith("/api/transit/routes/first-last/search?"));
  assert.ok(paths[2].startsWith("/api/transit/routes/first-last/search?"));
  assert.deepEqual(
    paths.map((path) => new URLSearchParams(path.split("?")[1]).get("scheduleType")),
    ["NORMAL", "FIRST_TRANSIT", "LAST_TRANSIT"],
  );
  assert.equal(new URLSearchParams(paths[1].split("?")[1]).get("originX"), "126.891116");
  await assert.rejects(routes.searchFirstLastTransitRoutes(places), /scheduleType/);
});

test("first-last search unwraps route data and preserves departure metadata", async () => {
  const cache = new Map();
  let requests = 0;
  const routes = load("src/api/transit/routes.js", {
    "../auth/tokens": { getAccessToken: () => "access" },
    "../auth/reissue": { reissueAuthTokens: async () => ({ accessToken: "next" }) },
    "../client": {
      requestJson: async () => {
        requests += 1;
        return {
          code: "SUCCESS",
          data: [{
            route: {
              routeId: "ROUTE_4ca59ef0b8b547f2",
              originAddress: "37.212014, 127.057355",
              destinationAddress: "37.220558, 127.074864",
              totalDurationMinutes: 32,
              segments: [
                { transitType: "WALK", durationMinutes: 8 },
                { transitType: "BUS", transitName: "1550-1", durationMinutes: 8 },
              ],
            },
            scheduleType: "FIRST_TRANSIT",
            estimatedDepartureAt: "2026-10-04T04:52:00+09:00",
          }],
        };
      },
    },
    "../homeCache": {
      homeCacheKeys: { transitRouteSearch: "route-search" },
      readHomeCacheAsync: async (key) => cache.get(key),
      writeHomeCacheAsync: async (key, value) => cache.set(key, value),
    },
  });

  const options = { originX: 127.057355, originY: 37.212014, scheduleType: "FIRST_TRANSIT" };
  const [candidate] = await routes.searchFirstLastTransitRoutes(options);
  assert.equal(candidate.routeId, "ROUTE_4ca59ef0b8b547f2");
  assert.equal(candidate.totalDurationMinutes, 32);
  assert.equal(candidate.segments[1].transitName, "1550-1");
  assert.equal(candidate.scheduleType, "FIRST_TRANSIT");
  assert.equal(candidate.estimatedDepartureAt, "2026-10-04T04:52:00+09:00");
  assert.equal(candidate.raw.routeId, candidate.routeId);
  assert.equal((await routes.searchFirstLastTransitRoutes(options))[0].routeId, candidate.routeId);
  assert.equal(requests, 1);
});

test("first-last search preserves T005 message for the route screen", async () => {
  const message = "첫차·막차 시간표를 확인할 수 없는 경로입니다. 서울 버스·지하철 지원 범위를 확인해주세요.";
  const routes = load("src/api/transit/routes.js", {
    "../auth/tokens": { getAccessToken: () => "access" },
    "../auth/reissue": { reissueAuthTokens: async () => ({ accessToken: "next" }) },
    "../client": {
      requestJson: async () => ({ code: "T005", message }),
    },
    "../homeCache": {
      homeCacheKeys: { transitRouteSearch: "route-search" },
      readHomeCacheAsync: async () => null,
      writeHomeCacheAsync: async () => {},
    },
  });

  await assert.rejects(
    routes.searchFirstLastTransitRoutes({ scheduleType: "FIRST_TRANSIT" }),
    (error) => error.code === "T005" && error.message === message,
  );
});

test("transit notification registration preserves T005 message", async () => {
  const message = "첫차·막차 시간표를 확인할 수 없는 경로입니다. 서울 버스·지하철 지원 범위를 확인해주세요.";
  const transit = load("src/api/notifications/transit.js", {
    "../auth/tokens": { getAccessToken: () => "access" },
    "../auth/reissue": { reissueAuthTokens: async () => ({ accessToken: "next" }) },
    "../client": { requestJson: async () => ({ code: "T005", message }) },
    "../homeCache": {
      homeCacheKeys: {
        firstTransitNotifications: "first",
        lastTransitNotifications: "last",
      },
      readHomeCacheAsync: async () => null,
      writeHomeCacheAsync: async () => {},
    },
  });

  await assert.rejects(
    transit.createTransitNotification({ payload: { scheduleType: "FIRST_TRANSIT" } }),
    (error) => error.code === "T005" && error.message === message,
  );
});
