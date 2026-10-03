import { getAccessToken } from "../auth/tokens";
import { reissueAuthTokens } from "../auth/reissue";
import { requestJson } from "../client";
import {
  homeCacheKeys,
  readHomeCacheAsync,
  writeHomeCacheAsync,
} from "../homeCache";

const TRANSIT_NOTIFICATIONS_ENDPOINT = "/api/notifications/transit";
const TRANSIT_NOTIFICATIONS_CACHE_TTL_MS = 60 * 1000;
export const TRANSIT_SCHEDULE_TYPES = {
  first: "FIRST_TRANSIT",
  last: "LAST_TRANSIT",
};

function normalizeTransitScheduleType(scheduleType) {
  return scheduleType === TRANSIT_SCHEDULE_TYPES.last
    ? TRANSIT_SCHEDULE_TYPES.last
    : TRANSIT_SCHEDULE_TYPES.first;
}

function getTransitNotificationsCacheKey(scheduleType) {
  return normalizeTransitScheduleType(scheduleType) === TRANSIT_SCHEDULE_TYPES.last
    ? homeCacheKeys.lastTransitNotifications
    : homeCacheKeys.firstTransitNotifications;
}

function buildTransitNotificationsPath(scheduleType) {
  const normalizedScheduleType = normalizeTransitScheduleType(scheduleType);

  return `${TRANSIT_NOTIFICATIONS_ENDPOINT}?scheduleType=${encodeURIComponent(normalizedScheduleType)}`;
}

function buildTransitNotificationEndpoint(notificationId) {
  return `${TRANSIT_NOTIFICATIONS_ENDPOINT}/${encodeURIComponent(notificationId)}`;
}

async function writeTransitNotificationsCache(scheduleType, notifications) {
  const normalizedScheduleType = normalizeTransitScheduleType(scheduleType);
  const cacheKey = getTransitNotificationsCacheKey(normalizedScheduleType);

  await writeHomeCacheAsync(cacheKey, {
    version: 2,
    savedAt: Date.now(),
    notifications,
  });

  return notifications;
}

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

  if (Array.isArray(data)) {
    return data;
  }

  if (!data || typeof data !== "object") {
    return [];
  }

  const list =
    data.notifications ??
    data.notificationList ??
    data.items ??
    data.content ??
    data.results;

  if (Array.isArray(list)) {
    return list;
  }

  const notification = data.notification ?? data;
  if (
    notification &&
    typeof notification === "object" &&
    (notification.notificationId !== undefined || notification.id !== undefined)
  ) {
    return [notification];
  }

  return [];
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
    estimatedDepartureAt: notification?.estimatedDepartureAt,
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
  forceRefresh = false,
  scheduleType = TRANSIT_SCHEDULE_TYPES.first,
  signal,
} = {}) {
  const normalizedScheduleType = normalizeTransitScheduleType(scheduleType);
  const cacheKey = getTransitNotificationsCacheKey(normalizedScheduleType);

  if (!forceRefresh) {
    const cachedNotifications = await readHomeCacheAsync(cacheKey);

    if (
      cachedNotifications?.version === 2 &&
      Number.isFinite(cachedNotifications.savedAt) &&
      Date.now() - cachedNotifications.savedAt < TRANSIT_NOTIFICATIONS_CACHE_TTL_MS &&
      Array.isArray(cachedNotifications.notifications)
    ) {
      return cachedNotifications.notifications;
    }
  }

  const response = await requestTransitNotificationJson({
    path: buildTransitNotificationsPath(normalizedScheduleType),
    method: "GET",
    accessToken,
    signal,
    errorMessage: "첫막차 경로 목록을 불러오지 못했습니다.",
  });

  return writeTransitNotificationsCache(
    normalizedScheduleType,
    pickTransitNotificationList(response).map(normalizeTransitNotification),
  );
}

export async function getTransitNotification({
  notificationId,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  if (notificationId === undefined || notificationId === null || notificationId === "") {
    throw new Error("조회할 경로 id가 없습니다.");
  }

  const response = await requestTransitNotificationJson({
    path: buildTransitNotificationEndpoint(notificationId),
    method: "GET",
    accessToken,
    signal,
    errorMessage: "경로 상세 정보를 불러오지 못했습니다.",
  });

  const notification = response?.data ?? response;

  return normalizeTransitNotification(notification);
}

export async function createTransitNotification({
  payload,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  const requestBody = {
    reminderOffsetMinutes: Array.isArray(payload?.reminderOffsetMinutes)
      ? payload.reminderOffsetMinutes
      : [],
    routeDetails:
      typeof payload?.routeDetails === "string"
        ? payload.routeDetails
        : JSON.stringify(payload?.routeDetails ?? {}),
    scheduleType: normalizeTransitScheduleType(payload?.scheduleType),
  };

  const response = await requestTransitNotificationJson({
    path: TRANSIT_NOTIFICATIONS_ENDPOINT,
    method: "POST",
    body: requestBody,
    accessToken,
    signal,
    errorMessage: "첫막차 경로 등록에 실패했습니다.",
  });

  const notification = response?.data ?? response;

  await getTransitNotifications({
    accessToken,
    forceRefresh: true,
    scheduleType: requestBody.scheduleType,
    signal,
  }).catch(() => null);

  return notification;
}
