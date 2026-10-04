import { getAddresses } from "./addresses";
import { getMyPage } from "./mypage";
import { getArrivalNotifications } from "./notifications/arrival";
import { getMyDepotNotifications } from "./notifications/depot";
import {
  getTransitNotifications,
  TRANSIT_SCHEDULE_TYPES,
} from "./notifications/transit";
import {
  clearHomeCacheAsync,
  homeCacheKeys,
  readHomeCache,
  readHomeCacheAsync,
} from "./homeCache";

let preloadPromise = null;
let preloadController = null;
const CACHE_MISS = Symbol("cache-miss");

const requiredPreloadCacheKeys = [
  homeCacheKeys.addresses,
  homeCacheKeys.scheduleNotifications,
  homeCacheKeys.firstTransitNotifications,
  homeCacheKeys.lastTransitNotifications,
  homeCacheKeys.depotNotifications,
  homeCacheKeys.myPage,
];

async function hasRequiredPreloadCache() {
  const cachedValues = await Promise.all(
    requiredPreloadCacheKeys.map((key) =>
      readHomeCacheAsync(key, CACHE_MISS),
    ),
  );

  return cachedValues.every((value) => value !== CACHE_MISS);
}

export function getCachedFirstLastRoute() {
  return readHomeCache(homeCacheKeys.firstLastRoute, null);
}

export function getCachedFirstLastRouteAsync() {
  return readHomeCacheAsync(homeCacheKeys.firstLastRoute, null);
}

export async function cancelHomePreload() {
  preloadController?.abort();
  await preloadPromise?.catch(() => null);
}

export async function preloadHomeCache({ reset = false, signal } = {}) {
  if (preloadPromise && !reset) {
    return preloadPromise;
  }

  if (preloadPromise && reset) {
    await cancelHomePreload();
  }

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", onAbort, { once: true });
  preloadController = controller;

  preloadPromise = (async () => {
    if (reset) {
      await clearHomeCacheAsync();
    } else if (await hasRequiredPreloadCache()) {
      return;
    }

    if (controller.signal.aborted) return;
    await getCachedFirstLastRouteAsync();
    if (controller.signal.aborted) return;
    const results = await Promise.allSettled([
      getAddresses({ forceRefresh: true, signal: controller.signal }),
      getTransitNotifications({
        forceRefresh: true,
        scheduleType: TRANSIT_SCHEDULE_TYPES.first,
        signal: controller.signal,
      }),
      getTransitNotifications({
        forceRefresh: true,
        scheduleType: TRANSIT_SCHEDULE_TYPES.last,
        signal: controller.signal,
      }),
      getArrivalNotifications({ forceRefresh: true, signal: controller.signal }),
      getMyDepotNotifications({ forceRefresh: true, signal: controller.signal }),
      getMyPage({ forceRefresh: true, signal: controller.signal }),
    ]);
    const failure = results.find((result) => result.status === "rejected");
    if (failure) throw failure.reason;
  })().finally(() => {
    signal?.removeEventListener("abort", onAbort);
    preloadController = null;
    preloadPromise = null;
  });

  return preloadPromise;
}
