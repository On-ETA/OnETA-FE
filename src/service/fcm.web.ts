type WebRemoteMessage = MessagePayload & {
  messageId?: string;
};

type FirebaseOptions = {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
};

type MessagePayload = {
  notification?: {
    title?: string;
    body?: string;
  };
  data?: Record<string, string>;
};

type Messaging = unknown;

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const vapidKey = process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY;
let messagingPromise: Promise<Messaging | null> | null = null;
let serviceWorkerPromise: Promise<ServiceWorkerRegistration | null> | null = null;
let firebaseMessagingModulePromise: Promise<typeof import("firebase/messaging")> | null = null;

function loadFirebaseMessaging() {
  if (!firebaseMessagingModulePromise) {
    firebaseMessagingModulePromise = import("firebase/messaging");
  }

  return firebaseMessagingModulePromise;
}

function hasFirebaseConfig() {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.messagingSenderId &&
      firebaseConfig.appId,
  );
}

function encodeServiceWorkerConfig() {
  const params = new URLSearchParams();

  Object.entries(firebaseConfig).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  return params.toString();
}

async function getServiceWorkerRegistration() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  if (!serviceWorkerPromise) {
    serviceWorkerPromise = navigator.serviceWorker.register(
      `/firebase-messaging-sw.js?${encodeServiceWorkerConfig()}`,
    );
  }

  return serviceWorkerPromise;
}

async function getWebMessaging() {
  if (!hasFirebaseConfig() || typeof window === "undefined") {
    return null;
  }

  if (!messagingPromise) {
    messagingPromise = Promise.all([
      import("firebase/app"),
      loadFirebaseMessaging(),
    ]).then(async ([firebaseApp, firebaseMessaging]) => {
      const supported = await firebaseMessaging.isSupported();
      if (!supported) return null;
      const app = firebaseApp.getApps().length
        ? firebaseApp.getApp()
        : firebaseApp.initializeApp(firebaseConfig);
      await getServiceWorkerRegistration();
      return firebaseMessaging.getMessaging(app);
    }).catch((error) => {
      console.warn("[FCM] Web messaging unavailable", error?.code ?? error?.name);
      return null;
    });
  }

  return messagingPromise;
}

export const supportsFcm =
  typeof window !== "undefined" &&
  typeof Notification !== "undefined" &&
  typeof navigator !== "undefined" &&
  "serviceWorker" in navigator &&
  hasFirebaseConfig();

export async function requestNotificationPermission(prompt = true) {
  if (!supportsFcm) return false;
  if (Notification.permission === "granted") return true;
  if (!prompt || Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

export async function getFcmToken() {
  const messaging = await getWebMessaging();
  const serviceWorkerRegistration = await getServiceWorkerRegistration();

  if (!messaging || !serviceWorkerRegistration) return null;

  const { getToken: getMessagingToken } = await loadFirebaseMessaging();

  return getMessagingToken(messaging, {
    vapidKey,
    serviceWorkerRegistration,
  });
}

export async function deleteFcmToken() {
  const messaging = await getWebMessaging();
  if (messaging) {
    const { deleteToken: deleteMessagingToken } = await loadFirebaseMessaging();
    await deleteMessagingToken(messaging);
  }
}

export function listenForegroundMessage(callback: (message: WebRemoteMessage) => void) {
  let unsubscribe = () => {};
  let disposed = false;
  const serviceWorker = typeof navigator !== "undefined" ? navigator.serviceWorker : undefined;
  const onBackgroundMessage = (event: MessageEvent) => {
    if (!disposed && event.data?.type === "ONETA_FCM_RECEIVED") {
      callback(event.data.payload);
    }
  };
  serviceWorker?.addEventListener("message", onBackgroundMessage);

  getWebMessaging().then((messaging) => {
    if (disposed || !messaging) return;
    loadFirebaseMessaging().then(({ onMessage: onMessagingMessage }) => {
      if (disposed) return;
      unsubscribe = onMessagingMessage(messaging, callback);
    });
  });

  return () => {
    disposed = true;
    unsubscribe();
    serviceWorker?.removeEventListener("message", onBackgroundMessage);
  };
}

export function listenTokenRefresh() {
  return () => {};
}

export function listenNotificationOpen(callback: (message: WebRemoteMessage) => void) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return () => {};
  }

  const listener = (event: MessageEvent) => {
    if (event.data?.type === "ONETA_FCM_NOTIFICATION_CLICK") {
      callback(event.data.payload);
    }
  };

  navigator.serviceWorker.addEventListener("message", listener);
  return () => navigator.serviceWorker.removeEventListener("message", listener);
}

export const getInitialFcmNotification = async () => null;
export const isHeadlessLaunch = async () => false;
export const registerBackgroundFcmHandler = () => {};
