const ACCESS_TOKEN_KEY = "oneta.accessToken";
const REFRESH_TOKEN_KEY = "oneta.refreshToken";
const listeners = new Set();
let sessionId = 0;
let persistentAuthEnabled = false;

export function getAuthSessionId() {
  return sessionId;
}

export function subscribeAuthTokens(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let memoryTokens = {
  accessToken: null,
  refreshToken: null,
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

function getNativeAsyncStorage() {
  try {
    const asyncStorageModule = require("@react-native-async-storage/async-storage");

    return asyncStorageModule?.default ?? asyncStorageModule;
  } catch {
    return null;
  }
}

async function persistTokens({ accessToken, refreshToken } = {}) {
  const storage = getStorage();

  if (storage) {
    if (accessToken) {
      storage.setItem(ACCESS_TOKEN_KEY, accessToken);
    } else {
      storage.removeItem(ACCESS_TOKEN_KEY);
    }

    if (refreshToken) {
      storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    } else {
      storage.removeItem(REFRESH_TOKEN_KEY);
    }

    return;
  }

  const asyncStorage = getNativeAsyncStorage();

  if (asyncStorage) {
    const tasks = accessToken
      ? [asyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken)]
      : [asyncStorage.removeItem(ACCESS_TOKEN_KEY)];

    tasks.push(
      refreshToken
        ? asyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
        : asyncStorage.removeItem(REFRESH_TOKEN_KEY),
    );

    await Promise.all(tasks);
  }
}

async function clearPersistedTokens() {
  await persistTokens();
}

async function readPersistedTokens() {
  const storage = getStorage();

  if (storage) {
    return {
      accessToken: storage.getItem(ACCESS_TOKEN_KEY),
      refreshToken: storage.getItem(REFRESH_TOKEN_KEY),
    };
  }

  const asyncStorage = getNativeAsyncStorage();

  if (!asyncStorage) {
    return {
      accessToken: null,
      refreshToken: null,
    };
  }

  const [accessToken, refreshToken] = await Promise.all([
    asyncStorage.getItem(ACCESS_TOKEN_KEY),
    asyncStorage.getItem(REFRESH_TOKEN_KEY),
  ]);

  return {
    accessToken,
    refreshToken,
  };
}

export function extractAuthTokens(response) {
  return {
    accessToken: response?.data?.accessToken ?? null,
    refreshToken: response?.data?.refreshToken ?? null,
  };
}

export function setAuthTokens(
  { accessToken, refreshToken } = {},
  { isRefresh = false, persist } = {},
) {
  if (!isRefresh) {
    sessionId += 1;
    persistentAuthEnabled = Boolean(persist);
  }

  memoryTokens = {
    accessToken: accessToken ?? null,
    refreshToken: refreshToken ?? null,
  };

  const persistence = persistentAuthEnabled
    ? persistTokens(memoryTokens)
    : !isRefresh
      ? clearPersistedTokens()
      : Promise.resolve();

  listeners.forEach((listener) => listener(memoryTokens));
  return persistence;
}

export function getAuthTokens() {
  return memoryTokens;
}

export function getAccessToken() {
  return getAuthTokens().accessToken;
}

export function clearAuthTokens() {
  return setAuthTokens();
}

export async function hydrateAuthTokens() {
  const persistedTokens = await readPersistedTokens();

  if (!persistedTokens.accessToken && !persistedTokens.refreshToken) {
    persistentAuthEnabled = false;
    return memoryTokens;
  }

  persistentAuthEnabled = true;
  memoryTokens = {
    accessToken: persistedTokens.accessToken ?? null,
    refreshToken: persistedTokens.refreshToken ?? null,
  };

  listeners.forEach((listener) => listener(memoryTokens));

  return memoryTokens;
}
