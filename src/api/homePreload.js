import { getMyPage } from "./mypage";
import { getArrivalNotifications } from "./notifications/arrival";
import { getMyDepotNotifications } from "./notifications/depot";
import { homeCacheKeys, readHomeCache, readHomeCacheAsync } from "./homeCache";

let preloadPromise = null;

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

  preloadPromise = (async () => {
    await getCachedFirstLastRouteAsync();
    await getArrivalNotifications({ forceRefresh: true, signal });
    await getMyDepotNotifications({ forceRefresh: true, signal });
    await getMyPage({ forceRefresh: true, signal });
  })().finally(() => {
    preloadPromise = null;
  });

  return preloadPromise;
}
