import { getMyPage } from "./mypage";
import { getArrivalNotifications } from "./notifications/arrival";
import { getMyDepotNotifications } from "./notifications/depot";
import { homeCacheKeys, readHomeCache } from "./homeCache";

let preloadPromise = null;

async function attemptPreload(load) {
  try {
    await load();
  } catch {
    // Keep the remaining preload sequence moving.
  }
}

export function getCachedFirstLastRoute() {
  return readHomeCache(homeCacheKeys.firstLastRoute, null);
}

export async function preloadHomeCache({ signal } = {}) {
  if (preloadPromise) {
    return preloadPromise;
  }

  preloadPromise = (async () => {
    getCachedFirstLastRoute();
    await attemptPreload(() =>
      getArrivalNotifications({ signal }),
    );
    await attemptPreload(() =>
      getMyDepotNotifications({ signal }),
    );
    await attemptPreload(() => getMyPage({ signal }));
  })().finally(() => {
    preloadPromise = null;
  });

  return preloadPromise;
}
