const ACCESS_TOKEN_KEY = "oneta.accessToken";
const REFRESH_TOKEN_KEY = "oneta.refreshToken";
const listeners = new Set();
let sessionId = 0;

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

export function extractAuthTokens(response) {
  return {
    accessToken: response?.data?.accessToken ?? null,
    refreshToken: response?.data?.refreshToken ?? null,
  };
}

export function setAuthTokens(
  { accessToken, refreshToken } = {},
  { isRefresh = false } = {},
) {
  if (!isRefresh) sessionId += 1;
  memoryTokens = {
    accessToken: accessToken ?? null,
    refreshToken: refreshToken ?? null,
  };

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
  }

  listeners.forEach((listener) => listener(memoryTokens));
}

export function getAuthTokens() {
  const storage = getStorage();

  if (!storage) {
    return memoryTokens;
  }

  return {
    accessToken: storage.getItem(ACCESS_TOKEN_KEY) ?? memoryTokens.accessToken,
    refreshToken: storage.getItem(REFRESH_TOKEN_KEY) ?? memoryTokens.refreshToken,
  };
}

export function getAccessToken() {
  return getAuthTokens().accessToken;
}

export function clearAuthTokens() {
  setAuthTokens();
}
