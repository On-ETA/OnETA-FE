import { registerDeviceToken } from "../api/notifications/deviceTokens";

const DEVICE_TOKEN_STORAGE_KEYS = [
  "oneta.deviceToken",
  "oneta.fcmToken",
  "oneta.apnsToken",
  "oneta.pushToken",
];

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

export function getSavedDeviceToken() {
  if (typeof globalThis !== "undefined" && globalThis.__ONETA_DEVICE_TOKEN__) {
    return globalThis.__ONETA_DEVICE_TOKEN__;
  }

  const storage = getStorage();

  if (!storage) {
    return null;
  }

  return (
    DEVICE_TOKEN_STORAGE_KEYS.map((key) => storage.getItem(key)).find(Boolean) ??
    null
  );
}

export async function registerSavedDeviceToken({
  accessToken,
  deviceToken = getSavedDeviceToken(),
  signal,
} = {}) {
  if (!deviceToken) {
    return { skipped: true };
  }

  await registerDeviceToken({
    accessToken,
    deviceToken,
    signal,
  });

  return { skipped: false };
}
