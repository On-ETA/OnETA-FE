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

function maskToken(token) {
  if (!token) return "empty";
  if (token.length <= 12) return `${token.length} chars`;
  return `${token.slice(0, 6)}...${token.slice(-6)} (${token.length} chars)`;
}

function fcmDiag(message, details) {
  if (typeof __DEV__ !== "undefined" && !__DEV__) return;
  console.warn("[FCM_DIAG]", message, details ?? "");
}

async function deletePendingToken() {
  if (!needsTokenDeletion) return;
  await deleteFcmToken();
  needsTokenDeletion = false;
}

export function startFcm({ onForegroundMessage, onNotificationOpen, onSessionEnd }) {
  fcmDiag("startFcm called", { supportsFcm, appState: AppState.currentState });
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
    if (!isActive()) {
      fcmDiag("schedule skipped: app is not active", { appState: AppState.currentState });
      return;
    }
    if (running) {
      fcmDiag("schedule deferred: sync already running");
      rerun = true;
      return;
    }
    fcmDiag("sync scheduled", { delay });
    timer = setTimeout(sync, delay);
  }

  async function sync() {
    if (!isActive()) {
      fcmDiag("sync skipped: app is not active", { appState: AppState.currentState });
      return;
    }
    running = true;
    const startedSession = getAuthSessionId();
    controller = new AbortController();
    const signal = controller.signal;
    try {
      fcmDiag("sync started", {
        hasAccessToken: Boolean(getAccessToken()),
        sessionId: startedSession,
      });
      const prompt = !prompted;
      prompted = true;
      const granted = await requestNotificationPermission(prompt);
      fcmDiag("permission result", { granted, prompt });
      if (!granted || disposed || signal.aborted) return;

      const tokenRequest = tokenOperation.then(async () => {
        await deletePendingToken();
        return getFcmToken();
      });
      tokenOperation = tokenRequest.then(() => {}, () => {});
      const token = await tokenRequest;
      fcmDiag("token acquired", { token: maskToken(token) });
      if (disposed || signal.aborted || startedSession !== getAuthSessionId()) {
        fcmDiag("registration skipped after token", {
          disposed,
          aborted: signal.aborted,
          startedSession,
          currentSession: getAuthSessionId(),
        });
        return;
      }
      setSavedDeviceToken(token);
      const result = await registerSavedDeviceToken({ deviceToken: token, signal });
      fcmDiag("server registration result", result);
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
    fcmDiag("foreground message received", { messageId: message?.messageId ?? null });
    if (!isActive() || !getAccessToken() || !firstDelivery(seenMessages, message)) return;
    invalidateNotifications();
    onForegroundMessage(message);
  });
  const unsubscribeOpen = listenNotificationOpen(open);
  const unsubscribeToken = listenTokenRefresh((token) => {
    fcmDiag("token refresh received", { token: maskToken(token) });
    setSavedDeviceToken(token);
    retries = 0;
    schedule();
  });
  const unsubscribeAuth = subscribeAuthTokens(({ accessToken }) => {
    fcmDiag("auth token change", {
      hasAccessToken: Boolean(accessToken),
      sessionId: getAuthSessionId(),
    });
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
    fcmDiag("app state changed", { state });
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
