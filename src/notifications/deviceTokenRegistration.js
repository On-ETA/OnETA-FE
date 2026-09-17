import { getAccessToken, getAuthSessionId } from "../api/auth/tokens";
import { registerFcmToken } from "../api/notifications/fcmApi";

let savedToken = null;
let registered = null;
const pending = new Map();

// Firebase persists its token natively; getToken restores it on the next launch.
export function setSavedDeviceToken(token) {
  savedToken = token;
  if (!token) registered = null;
}

export function getSavedDeviceToken() {
  return savedToken;
}

/**
 * @param {object} [options]
 * @param {string | null} [options.accessToken]
 * @param {string | null} [options.deviceToken]
 * @param {AbortSignal} [options.signal]
 */
export async function registerSavedDeviceToken({
  accessToken = getAccessToken(),
  deviceToken = getSavedDeviceToken(),
  signal,
} = {}) {
  const sessionId = getAuthSessionId();
  if (!accessToken || !deviceToken || signal?.aborted) return { skipped: true };
  if (registered?.sessionId === sessionId && registered.token === deviceToken) {
    return { skipped: true };
  }

  const key = `${sessionId}:${deviceToken}`;
  if (pending.has(key)) return pending.get(key);

  const request = registerFcmToken({ deviceToken, accessToken, signal })
    .then(() => {
      if (sessionId !== getAuthSessionId() || signal?.aborted) {
        return { skipped: true };
      }
      registered = { sessionId, token: deviceToken };
      return { skipped: false };
    })
    .finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}
