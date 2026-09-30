import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_PREFIX = "oneta.homeCache";

export const homeCacheKeys = {
  addresses: "addresses",
  firstLastRoute: "firstLastRoute",
  arrivalNotifications: "arrivalNotifications",
  scheduleNotifications: "scheduleNotifications",
  depotNotifications: "depotNotifications",
  hiddenArrivalNotifications: "hiddenArrivalNotifications",
  transitNotifications: "transitNotifications",
  myPage: "myPage",
};

const memoryCache = new Map();

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

  memoryCache.set(cacheKey, value);

  if (Platform.OS !== "web") {
    AsyncStorage.setItem(cacheKey, JSON.stringify(value)).catch(() => {
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

export function removeHomeCache(key) {
  const cacheKey = getCacheKey(key);

  memoryCache.delete(cacheKey);

  if (Platform.OS !== "web") {
    AsyncStorage.removeItem(cacheKey).catch(() => {
      // Ignore cache cleanup failures.
    });

    return;
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
  Object.values(homeCacheKeys).forEach((key) => {
    memoryCache.delete(getCacheKey(key));
  });

  if (Platform.OS === "web") {
    const storage = getWebStorage();

    if (!storage) {
      return;
    }

    Object.values(homeCacheKeys).forEach((key) => {
      try {
        storage.removeItem(getCacheKey(key));
      } catch {
        // Ignore cache cleanup failures.
      }
    });

    return;
  }

  await Promise.all(
    Object.values(homeCacheKeys).map((key) =>
      AsyncStorage.removeItem(getCacheKey(key)).catch(() => null),
    ),
  );
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
    const value = await AsyncStorage.getItem(cacheKey);
    const parsedValue = value ? JSON.parse(value) : fallbackValue;

    if (value) {
      memoryCache.set(cacheKey, parsedValue);
    }

    return parsedValue;
  } catch {
    return fallbackValue;
  }
}
