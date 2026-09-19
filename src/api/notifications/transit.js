import { getAccessToken } from "../auth/tokens";
import { reissueAuthTokens } from "../auth/reissue";
import { requestJson } from "../client";

const TRANSIT_NOTIFICATIONS_ENDPOINT = "/api/notifications/transit";

function isAuthError(error) {
  return (
    error?.status === 401 ||
    error?.status === 403 ||
    error?.code === "C007" ||
    error?.code === "C005"
  );
}

function createBusinessError(response, fallbackMessage) {
  if (!response?.code || response.code === "SUCCESS") {
    return null;
  }

  const error = new Error(response.message ?? fallbackMessage);

  error.code = response.code;
  error.data = response;

  return error;
}

async function requestTransitNotificationJson(options) {
  const fallbackMessage =
    options.errorMessage ?? "첫막차 알림 요청에 실패했습니다.";

  try {
    const response = await requestJson(options);
    const businessError = createBusinessError(response, fallbackMessage);

    if (businessError) {
      throw businessError;
    }

    return response;
  } catch (error) {
    if (!isAuthError(error)) {
      throw error;
    }

    let nextAccessToken;

    try {
      const { accessToken } = await reissueAuthTokens({
        signal: options.signal,
      });
      nextAccessToken = accessToken;
    } catch {
      throw error;
    }

    const response = await requestJson({
      ...options,
      accessToken: nextAccessToken,
    });
    const businessError = createBusinessError(response, fallbackMessage);

    if (businessError) {
      throw businessError;
    }

    return response;
  }
}

function pickTransitNotificationList(response) {
  const data = response?.data ?? response;

  return Array.isArray(data) ? data : [];
}

function formatTwoDigits(value) {
  return String(value ?? 0).padStart(2, "0");
}

export function formatTransitTargetTime(targetArrivalTime) {
  if (!targetArrivalTime) {
    return "";
  }

  if (typeof targetArrivalTime === "string") {
    const [hour, minute] = targetArrivalTime.split(":");

    return hour && minute ? `${hour}:${minute}` : targetArrivalTime;
  }

  return `${formatTwoDigits(targetArrivalTime.hour)}:${formatTwoDigits(
    targetArrivalTime.minute,
  )}`;
}

export function parseTransitRouteDetails(routeDetails) {
  if (!routeDetails) {
    return null;
  }

  if (typeof routeDetails !== "string") {
    return routeDetails;
  }

  try {
    return JSON.parse(routeDetails);
  } catch {
    return null;
  }
}

export function normalizeTransitNotification(notification) {
  const notificationId = notification?.notificationId ?? notification?.id;
  const routeName = notification?.routeName ?? notification?.title ?? "첫막차 경로";
  const route = parseTransitRouteDetails(notification?.routeDetails);

  return {
    id:
      notificationId === undefined || notificationId === null
        ? undefined
        : `transit-${notificationId}`,
    category: notification?.category ?? "SCHEDULE",
    notificationId,
    routeName,
    title: routeName,
    targetArrivalTime: notification?.targetArrivalTime,
    arrivalTime: formatTransitTargetTime(notification?.targetArrivalTime),
    reminderOffsetMinutes: Array.isArray(notification?.reminderOffsetMinutes)
      ? notification.reminderOffsetMinutes
      : [],
    repeatDays: Array.isArray(notification?.repeatDays)
      ? notification.repeatDays
      : [],
    routeDetails: notification?.routeDetails,
    route,
    scheduleType: notification?.scheduleType ?? "NORMAL",
    enabled: Boolean(notification?.isActive),
    isActive: Boolean(notification?.isActive),
    payload: notification,
    raw: notification,
  };
}

export async function getTransitNotifications({
  accessToken = getAccessToken(),
  signal,
} = {}) {
  const response = await requestTransitNotificationJson({
    path: TRANSIT_NOTIFICATIONS_ENDPOINT,
    method: "GET",
    accessToken,
    signal,
    errorMessage: "첫막차 경로 목록을 불러오지 못했습니다.",
  });

  return pickTransitNotificationList(response).map(normalizeTransitNotification);
}

export async function createTransitNotification({
  payload,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  const response = await requestTransitNotificationJson({
    path: TRANSIT_NOTIFICATIONS_ENDPOINT,
    method: "POST",
    body: payload,
    accessToken,
    signal,
    errorMessage: "첫막차 경로 등록에 실패했습니다.",
  });

  return response?.data ?? response;
}
