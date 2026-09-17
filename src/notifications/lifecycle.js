import { AppState } from "react-native";
import { getAccessToken, getAuthSessionId, subscribeAuthTokens } from "../api/auth/tokens";
import {
  deleteFcmToken,
  getFcmToken,
  getInitialFcmNotification,
  listenForegroundMessage,
  listenNotificationOpen,
  listenTokenRefresh,
  requestNotificationPermission,
  supportsFcm,
} from "../service/fcm";
import { registerSavedDeviceToken, setSavedDeviceToken } from "./deviceTokenRegistration";
import { invalidateNotifications } from "./events";

// Keep token deletion ordered with issuance, including fast logout/login transitions.
let tokenOperation = Promise.resolve();
let needsTokenDeletion = false;

async function deletePendingToken() {
  if (!needsTokenDeletion) return;
  await deleteFcmToken();
  needsTokenDeletion = false;
}

export function startFcm({ onForegroundMessage, onNotificationOpen, onSessionEnd }) {
  if (!supportsFcm) return () => {};

  let disposed = false;
  let timer;
  let running = false;
  let rerun = false;
  let retries = 0;
  let prompted = false;
  let sessionId = getAuthSessionId();
  let hadSession = Boolean(getAccessToken());
  let controller;
  const seenMessages = new Set();
  const seenOpens = new Set();

  function isActive() {
    return !disposed && AppState.currentState === "active";
  }

  function schedule(delay = 0) {
    clearTimeout(timer);
    if (!isActive()) return;
    if (running) {
      rerun = true;
      return;
    }
    timer = setTimeout(sync, delay);
  }

  async function sync() {
    if (!isActive()) return;
    running = true;
    const startedSession = getAuthSessionId();
    controller = new AbortController();
    const signal = controller.signal;
    try {
      const prompt = !prompted;
      prompted = true;
      const granted = await requestNotificationPermission(prompt);
      if (!granted || disposed || signal.aborted) return;

      const tokenRequest = tokenOperation.then(async () => {
        await deletePendingToken();
        return getFcmToken();
      });
      tokenOperation = tokenRequest.then(() => {}, () => {});
      const token = await tokenRequest;
      if (disposed || signal.aborted || startedSession !== getAuthSessionId()) return;
      setSavedDeviceToken(token);
      await registerSavedDeviceToken({ deviceToken: token, signal });
      retries = 0;
    } catch (error) {
      if (!disposed && !signal.aborted) {
        // Never log tokens or notification contents.
        console.warn("[FCM] Registration failed", error?.code ?? error?.name);
        if (retries < 3 && isActive()) {
          timer = setTimeout(sync, 1000 * 2 ** retries++ + Math.random() * 500);
        }
      }
    } finally {
      running = false;
      if (rerun) {
        rerun = false;
        schedule();
      }
    }
  }

  function firstDelivery(seen, message) {
    if (!message.messageId) return true;
    if (seen.has(message.messageId)) return false;
    seen.add(message.messageId);
    if (seen.size > 100) seen.delete(seen.values().next().value);
    return true;
  }

  function open(message) {
    if (disposed || !message || !firstDelivery(seenOpens, message)) return;
    invalidateNotifications();
    onNotificationOpen(message);
  }

  const unsubscribeMessage = listenForegroundMessage((message) => {
    if (!isActive() || !getAccessToken() || !firstDelivery(seenMessages, message)) return;
    invalidateNotifications();
    onForegroundMessage(message);
  });
  const unsubscribeOpen = listenNotificationOpen(open);
  const unsubscribeToken = listenTokenRefresh((token) => {
    setSavedDeviceToken(token);
    retries = 0;
    schedule();
  });
  const unsubscribeAuth = subscribeAuthTokens(({ accessToken }) => {
    // Access-token refresh does not change the device/account binding.
    if (sessionId === getAuthSessionId()) return;
    sessionId = getAuthSessionId();
    controller?.abort();
    setSavedDeviceToken(null);
    if (hadSession) {
      needsTokenDeletion = true;
      tokenOperation = tokenOperation.then(deletePendingToken).catch((error) => {
        console.warn("[FCM] Token deletion failed", error?.code);
      });
      onSessionEnd();
    }
    hadSession = Boolean(accessToken);
    retries = 0;
    schedule();
  });
  const appStateSubscription = AppState.addEventListener("change", (state) => {
    if (state === "active") {
      retries = 0;
      invalidateNotifications();
      schedule();
    } else {
      clearTimeout(timer);
    }
  });

  getInitialFcmNotification().then(open).catch((error) => {
    console.warn("[FCM] Initial notification failed", error?.code ?? error?.name);
  });
  // Yield the initial render before permissions, token acquisition and network work.
  schedule(500);

  return () => {
    disposed = true;
    clearTimeout(timer);
    controller?.abort();
    unsubscribeMessage();
    unsubscribeOpen();
    unsubscribeToken();
    unsubscribeAuth();
    appStateSubscription.remove();
  };
}
