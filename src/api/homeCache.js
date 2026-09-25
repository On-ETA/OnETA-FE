const CACHE_PREFIX = "oneta.homeCache";

export const homeCacheKeys = {
  firstLastRoute: "firstLastRoute",
  arrivalNotifications: "arrivalNotifications",
  depotNotifications: "depotNotifications",
  myPage: "myPage",
};

function getStorage() {
  if (typeof globalThis === "undefined") {
    return null;
  }

  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function getCacheKey(key) {
  return `${CACHE_PREFIX}.${key}`;
}

export function readHomeCache(key, fallbackValue = null) {
  const storage = getStorage();

  if (!storage) {
    return fallbackValue;
  }

  try {
    const value = storage.getItem(getCacheKey(key));

    return value ? JSON.parse(value) : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

export function writeHomeCache(key, value) {
  const storage = getStorage();

  if (!storage) {
    return value;
  }

  try {
    storage.setItem(getCacheKey(key), JSON.stringify(value));
  } catch {
    // Cache writes should never block the app flow.
  }

  return value;
}

export function removeHomeCache(key) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  try {
    storage.removeItem(getCacheKey(key));
  } catch {
    // Ignore cache cleanup failures.
  }
}

export function clearHomeCache() {
  Object.values(homeCacheKeys).forEach(removeHomeCache);
}
