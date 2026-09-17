import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AuthorizationStatus,
  deleteToken,
  getIsHeadless,
  getMessaging,
  getToken,
  hasPermission,
  isDeviceRegisteredForRemoteMessages,
  onMessage,
  onTokenRefresh,
  onNotificationOpenedApp,
  getInitialNotification,
  registerDeviceForRemoteMessages,
  requestPermission,
  setBackgroundMessageHandler,
  type RemoteMessage,
} from "@react-native-firebase/messaging";
import { PermissionsAndroid, Platform } from "react-native";

export const supportsFcm = true;

export async function requestNotificationPermission(prompt = true) {
  if (Platform.OS === "android") {
    if (Number(Platform.Version) < 33) return true;
    const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
    if (await PermissionsAndroid.check(permission)) return true;
    return prompt
      ? (await PermissionsAndroid.request(permission)) === PermissionsAndroid.RESULTS.GRANTED
      : false;
  }

  const messaging = getMessaging();
  let status = await hasPermission(messaging);
  if (prompt && status === AuthorizationStatus.NOT_DETERMINED) {
    status = await requestPermission(messaging);
  }
  return status === AuthorizationStatus.AUTHORIZED ||
    status === AuthorizationStatus.PROVISIONAL;
}

export async function getFcmToken() {
  const messaging = getMessaging();
  if (Platform.OS === "ios" && !isDeviceRegisteredForRemoteMessages(messaging)) {
    await registerDeviceForRemoteMessages(messaging);
  }
  return getToken(messaging);
}

export function deleteFcmToken() {
  return deleteToken(getMessaging());
}

export function listenForegroundMessage(callback: (message: RemoteMessage) => void) {
  return onMessage(getMessaging(), callback);
}

export function listenTokenRefresh(callback: (token: string) => void) {
  return onTokenRefresh(getMessaging(), callback);
}

export function listenNotificationOpen(callback: (message: RemoteMessage) => void) {
  return onNotificationOpenedApp(getMessaging(), callback);
}

export function getInitialFcmNotification() {
  return getInitialNotification(getMessaging());
}

export function isHeadlessLaunch() {
  return Platform.OS === "ios" ? getIsHeadless(getMessaging()) : Promise.resolve(false);
}

// Registered at the entry point, including Android Headless JS launches.
export function registerBackgroundFcmHandler() {
  setBackgroundMessageHandler(getMessaging(), async (message) => {
    // Do not render UI or fetch the whole inbox while running in the background.
    await AsyncStorage.setItem("oneta.notifications.lastBackgroundReceipt", JSON.stringify({
      messageId: message.messageId ?? null,
      receivedAt: Date.now(),
    }));
  });
}
