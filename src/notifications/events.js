import { homeCacheKeys, removeHomeCache, writeHomeCacheAsync } from "../api/homeCache";
import { getAccessToken, getAuthSessionId, subscribeAuthTokens } from "../api/auth/tokens";
import { getMyDepotNotifications } from "../api/notifications/depot";
import { getArrivalNotifications } from "../api/notifications/arrival";
import { getTransitNotifications, TRANSIT_SCHEDULE_TYPES } from "../api/notifications/transit";

export const FCM_NOTIFICATION_TYPES = {
  schedule: "normal",
  transit: "firstandlast",
  depot: "depot",
};

const listeners = new Set();
const activeRequests = new Map();
const receipts = new Map();
const failedTypes = new Map();
const RETRY_DELAYS_MS = [300, 900];
let sessionId = getAuthSessionId?.();

subscribeAuthTokens?.(() => {
  if (sessionId === getAuthSessionId?.()) return;
  sessionId = getAuthSessionId?.();
  activeRequests.forEach(({ controller }) => controller.abort());
  activeRequests.clear();
  receipts.clear();
  failedTypes.clear();
});

function abortError() {
  return Object.assign(new Error("알림 갱신이 취소되었습니다."), { name: "AbortError" });
}

function waitForRetry(delay, signal) {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delay);
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
}

function getRefreshes(type) {
  switch (type) {
    case FCM_NOTIFICATION_TYPES.schedule:
      return [{ key: homeCacheKeys.scheduleNotifications, load: getArrivalNotifications }];
    case FCM_NOTIFICATION_TYPES.depot:
      return [{ key: homeCacheKeys.depotNotifications, load: getMyDepotNotifications }];
    case FCM_NOTIFICATION_TYPES.transit:
      return [
        { key: homeCacheKeys.firstTransitNotifications, load: getTransitNotifications, scheduleType: TRANSIT_SCHEDULE_TYPES.first },
        { key: homeCacheKeys.lastTransitNotifications, load: getTransitNotifications, scheduleType: TRANSIT_SCHEDULE_TYPES.last },
      ];
    default:
      return [];
  }
}

async function refreshList(job, persist, requestSession) {
  activeRequests.get(job.key)?.controller.abort();
  const request = { controller: new AbortController() };
  activeRequests.set(job.key, request);
  const { signal } = request.controller;
  const assertCurrent = () => {
    if (signal.aborted || requestSession !== getAuthSessionId?.() || activeRequests.get(job.key) !== request) {
      throw abortError();
    }
  };
  removeHomeCache(job.key);
  try {
    for (let attempt = 0; ; attempt++) {
      assertCurrent();
      try {
        const value = await job.load({ accessToken: getAccessToken(), forceRefresh: true, scheduleType: job.scheduleType, signal });
        assertCurrent();
        if (persist && !job.scheduleType) await writeHomeCacheAsync(job.key, value);
        assertCurrent();
        return { key: job.key, scheduleType: job.scheduleType, status: "fulfilled", value };
      } catch (error) {
        assertCurrent();
        const transient = !error?.status || error.status >= 500 || error.status === 408 || error.status === 429;
        if (error?.name === "AbortError" || !transient || attempt >= RETRY_DELAYS_MS.length) throw error;
        await waitForRetry(RETRY_DELAYS_MS[attempt], signal);
      }
    }
  } catch (error) {
    return { key: job.key, scheduleType: job.scheduleType, status: "rejected", error };
  } finally {
    if (activeRequests.get(job.key) === request) activeRequests.delete(job.key);
  }
}

async function refreshMessage(message, persist) {
  const type = message?.data?.type;
  const requestSession = getAuthSessionId?.();
  const jobs = getRefreshes(type);
  if (!getAccessToken()) return [];
  const results = await Promise.all(jobs.map(job => refreshList(job, persist, requestSession)));
  if (requestSession !== getAuthSessionId?.()) return results;
  // A superseded message must not change the screen or schedule another retry.
  if (results.some(result => result.error?.name === "AbortError")) return results;
  if (results.some(result => result.status === "rejected")) {
    failedTypes.set(type, { message, persist });
    console.warn("[FCM] Notification refresh failed", type);
  } else {
    failedTypes.delete(type);
  }
  listeners.forEach(listener => {
    try { listener(message, { results }); }
    catch (error) { console.warn("[FCM] Notification listener failed", error?.name); }
  });
  return results;
}

export function invalidateNotifications(message, { persist = false } = {}) {
  if (!message) {
    // On foreground return, retry only the types that actually failed.
    const pending = [...failedTypes.values()];
    if (pending.length) return Promise.all(pending.map(entry => invalidateNotifications(entry.message, { persist: entry.persist })));
    listeners.forEach(listener => {
      try { listener(); }
      catch (error) { console.warn("[FCM] Notification listener failed", error?.name); }
    });
    return Promise.resolve([]);
  }
  if (!getAccessToken()) return Promise.resolve([]);
  const receiptKey = message.messageId && `${getAuthSessionId?.()}:${message.data?.type}:${message.messageId}`;
  if (receiptKey && receipts.has(receiptKey)) return receipts.get(receiptKey);
  const refresh = refreshMessage(message, persist);
  if (receiptKey) {
    receipts.set(receiptKey, refresh);
    refresh.then(results => {
      if (results.some(result => result.status === "rejected") && receipts.get(receiptKey) === refresh) receipts.delete(receiptKey);
    });
    if (receipts.size > 100) receipts.delete(receipts.keys().next().value);
  }
  return refresh;
}

export function subscribeNotifications(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
