import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_PREFIX = "oneta.homeCache";

export const homeCacheKeys = {
  addresses: "addresses",
  firstLastRoute: "firstLastRoute",
  firstTransitRoute: "firstTransitRoute",
  lastTransitRoute: "lastTransitRoute",
  transitRouteSearch: "transitRouteSearch",
  arrivalNotifications: "arrivalNotifications",
  scheduleNotifications: "scheduleNotifications",
  depotNotifications: "depotNotifications",
  hiddenArrivalNotifications: "hiddenArrivalNotifications",
  transitNotifications: "transitNotifications",
  firstTransitNotifications: "firstTransitNotifications",
  lastTransitNotifications: "lastTransitNotifications",
  myPage: "myPage",
};

const memoryCache = new Map();
const cacheVersions = new Map();
const storageOperations = new Map();

function markCacheChange(cacheKey) {
  cacheVersions.set(cacheKey, (cacheVersions.get(cacheKey) ?? 0) + 1);
}

function enqueueStorageOperation(cacheKey, task) {
  const previous = storageOperations.get(cacheKey) ?? Promise.resolve();
  const pending = previous.catch(() => null).then(task);
  storageOperations.set(cacheKey, pending);
  const cleanup = () => {
    if (storageOperations.get(cacheKey) === pending) storageOperations.delete(cacheKey);
  };
  pending.then(cleanup, cleanup);
  return pending;
}

function getWebStorage() {
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
  const cacheKey = getCacheKey(key);

  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }

  const storage = getWebStorage();

  if (!storage) {
    return fallbackValue;
  }

  try {
    const value = storage.getItem(cacheKey);
    const parsedValue = value ? JSON.parse(value) : fallbackValue;

    if (value) {
      memoryCache.set(cacheKey, parsedValue);
    }

    return parsedValue;
  } catch {
    return fallbackValue;
  }
}

export function writeHomeCache(key, value) {
  const cacheKey = getCacheKey(key);
  markCacheChange(cacheKey);
  memoryCache.set(cacheKey, value);

  if (Platform.OS !== "web") {
    enqueueStorageOperation(cacheKey, () => AsyncStorage.setItem(cacheKey, JSON.stringify(value))).catch(() => {
      // Cache writes should never block the app flow.
    });

    return value;
  }

  const storage = getWebStorage();

  if (!storage) {
    return value;
  }

  try {
    storage.setItem(cacheKey, JSON.stringify(value));
  } catch {
    // Cache writes should never block the app flow.
  }

  return value;
}

export async function writeHomeCacheAsync(key, value) {
  const cacheKey = getCacheKey(key);
  markCacheChange(cacheKey);
  memoryCache.set(cacheKey, value);

  if (Platform.OS === "web") {
    const storage = getWebStorage();

    if (!storage) {
      return value;
    }

    try {
      storage.setItem(cacheKey, JSON.stringify(value));
    } catch {
      // Cache writes should never block the app flow.
    }

    return value;
  }

  await enqueueStorageOperation(cacheKey, () => AsyncStorage.setItem(cacheKey, JSON.stringify(value))).catch(() => null);

  return value;
}

export function removeHomeCache(key) {
  const cacheKey = getCacheKey(key);
  markCacheChange(cacheKey);
  memoryCache.delete(cacheKey);

  if (Platform.OS !== "web") {
    return enqueueStorageOperation(cacheKey, () => AsyncStorage.removeItem(cacheKey)).catch(() => {
      // Ignore cache cleanup failures.
    });

  }

  const storage = getWebStorage();

  if (!storage) {
    return;
  }

  try {
    storage.removeItem(cacheKey);
  } catch {
    // Ignore cache cleanup failures.
  }
}

export function clearHomeCache() {
  Object.values(homeCacheKeys).forEach(removeHomeCache);
}

export async function clearHomeCacheAsync() {
  await Promise.all(Object.values(homeCacheKeys).map(removeHomeCache));
}

export async function readHomeCacheAsync(key, fallbackValue = null) {
  const cacheKey = getCacheKey(key);

  if (Platform.OS === "web") {
    return readHomeCache(key, fallbackValue);
  }

  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }

  try {
    await storageOperations.get(cacheKey)?.catch(() => null);
    if (memoryCache.has(cacheKey)) return memoryCache.get(cacheKey);
    const version = cacheVersions.get(cacheKey);
    const value = await AsyncStorage.getItem(cacheKey);
    if (version !== cacheVersions.get(cacheKey)) return readHomeCache(key, fallbackValue);
    const parsedValue = value ? JSON.parse(value) : fallbackValue;

    if (value) {
      memoryCache.set(cacheKey, parsedValue);
    }

    return parsedValue;
  } catch {
    return fallbackValue;
  }
}
