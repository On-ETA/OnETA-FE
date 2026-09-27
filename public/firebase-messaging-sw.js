importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js");

const params = new URL(self.location.href).searchParams;
const firebaseConfig = {
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  storageBucket: params.get("storageBucket"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
  measurementId: params.get("measurementId"),
};

if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId && firebaseConfig.appId) {
  firebase.initializeApp(firebaseConfig);

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || payload.data?.title || "ON-ETA";
    const body = payload.notification?.body || payload.data?.body;

    self.registration.showNotification(title, {
      body,
      data: payload,
      icon: "/images/on-eta_logo.png",
      badge: "/images/on-eta_logo.png",
    });
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const payload = event.notification.data || null;

  event.waitUntil((async () => {
    const clientsList = await clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });

    for (const client of clientsList) {
      client.postMessage({
        type: "ONETA_FCM_NOTIFICATION_CLICK",
        payload,
      });

      if ("focus" in client) {
        await client.focus();
      }

      return;
    }

    await clients.openWindow("/");
  })());
});
