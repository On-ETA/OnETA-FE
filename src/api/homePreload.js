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

const requiredPreloadCacheKeys = [
  homeCacheKeys.addresses,
  homeCacheKeys.scheduleNotifications,
  homeCacheKeys.firstTransitNotifications,
  homeCacheKeys.lastTransitNotifications,
  homeCacheKeys.depotNotifications,
  homeCacheKeys.myPage,
];

function hasRequiredPreloadCache() {
  return requiredPreloadCacheKeys.every(
    (key) => readHomeCache(key, undefined) !== undefined,
  );
}

export function getCachedFirstLastRoute() {
  return readHomeCache(homeCacheKeys.firstLastRoute, null);
}

export function getCachedFirstLastRouteAsync() {
  return readHomeCacheAsync(homeCacheKeys.firstLastRoute, null);
}

export async function preloadHomeCache({ reset = false, signal } = {}) {
  if (preloadPromise && !reset) {
    return preloadPromise;
  }

  if (preloadPromise && reset) {
    await preloadPromise.catch(() => null);
  }

  if (!reset && hasRequiredPreloadCache()) {
    return Promise.resolve();
  }

  preloadPromise = (async () => {
    if (reset) {
      await clearHomeCacheAsync();
    }

    await getCachedFirstLastRouteAsync();
    await getAddresses({ forceRefresh: true, signal });
    await getTransitNotifications({
      forceRefresh: true,
      scheduleType: TRANSIT_SCHEDULE_TYPES.first,
      signal,
    });
    await getTransitNotifications({
      forceRefresh: true,
      scheduleType: TRANSIT_SCHEDULE_TYPES.last,
      signal,
    });
    await getArrivalNotifications({ forceRefresh: true, signal });
    await getMyDepotNotifications({ forceRefresh: true, signal });
    await getMyPage({ forceRefresh: true, signal });
  })().finally(() => {
    preloadPromise = null;
  });

  return preloadPromise;
}
