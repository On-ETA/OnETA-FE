import { getAddresses } from "./addresses";
import { getMyPage } from "./mypage";
import { getArrivalNotifications } from "./notifications/arrival";
import { getMyDepotNotifications } from "./notifications/depot";
import { getTransitNotifications } from "./notifications/transit";
import { homeCacheKeys, readHomeCache, readHomeCacheAsync } from "./homeCache";

let preloadPromise = null;

const requiredPreloadCacheKeys = [
  homeCacheKeys.addresses,
  homeCacheKeys.scheduleNotifications,
  homeCacheKeys.transitNotifications,
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

export async function preloadHomeCache({ signal } = {}) {
  if (preloadPromise) {
    return preloadPromise;
  }

  if (hasRequiredPreloadCache()) {
    return Promise.resolve();
  }

  preloadPromise = (async () => {
    await getCachedFirstLastRouteAsync();
    await Promise.allSettled([
      getAddresses({ forceRefresh: true, signal }),
      getArrivalNotifications({ forceRefresh: true, signal }),
      getTransitNotifications({ forceRefresh: true, signal }),
      getMyDepotNotifications({ forceRefresh: true, signal }),
      getMyPage({ forceRefresh: true, signal }),
    ]);
  })().finally(() => {
    preloadPromise = null;
  });

  return preloadPromise;
}
