import { createNavigationContainerRef } from "@react-navigation/native";
import { getAccessToken } from "../api/auth/tokens";
import { routes } from "../navigation/routes";

export const notificationNavigationRef = createNavigationContainerRef();
let pendingOpen = false;
const authRoutes = new Set([
  routes.login, routes.signup, routes.termsAgreement,
  routes.signupComplete, routes.findPassword,
]);

export function openNotificationInbox() {
  pendingOpen = true;
  flushNotificationNavigation();
}

export function clearPendingNotification() {
  pendingOpen = false;
}

export function flushNotificationNavigation() {
  if (!pendingOpen || !notificationNavigationRef.isReady() || !getAccessToken()) return;
  if (authRoutes.has(notificationNavigationRef.getCurrentRoute()?.name)) return;
  pendingOpen = false;
  notificationNavigationRef.navigate(routes.notifications);
}
