import { getAccessToken } from "../auth/tokens";
import { reissueAuthTokens } from "../auth/reissue";
import { requestJson } from "../client";
import {
  homeCacheKeys,
  readHomeCache,
  removeHomeCache,
  writeHomeCache,
} from "../homeCache";

const SCHEDULE_NOTIFICATIONS_ENDPOINT = "/api/notifications/schedules";
const ARRIVAL_NOTIFICATIONS_ENDPOINT = "/api/notifications/arrival";

function buildArrivalNotificationEndpoint(id) {
  return `${ARRIVAL_NOTIFICATIONS_ENDPOINT}/${encodeURIComponent(id)}`;
}

function buildArrivalNotificationStatusEndpoint(id) {
  return `${buildArrivalNotificationEndpoint(id)}/status`;
}

function buildArrivalNotificationsDeleteEndpoint(ids) {
  const query = new URLSearchParams();

  query.append("ids", ids.join(","));

  return `${ARRIVAL_NOTIFICATIONS_ENDPOINT}?${query.toString()}`;
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

async function requestArrivalNotificationJson(options) {
  const fallbackMessage =
    options.errorMessage ?? "도착 알림 요청에 실패했습니다.";

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

function pickArrivalNotificationList(response) {
  const data = response?.data ?? response;

  return Array.isArray(data) ? data : [];
}

function normalizeHiddenArrivalNotificationId(id) {
  if (id === undefined || id === null || id === "") {
    return null;
  }

  return String(id).replace(/^arrival-/, "");
}

function readHiddenArrivalNotificationIds() {
  const hiddenIds = readHomeCache(homeCacheKeys.hiddenArrivalNotifications, []);

  return Array.isArray(hiddenIds) ? hiddenIds.map(String) : [];
}

function isHiddenArrivalNotification(notification) {
  const hiddenIds = readHiddenArrivalNotificationIds();
  const notificationId = normalizeHiddenArrivalNotificationId(
    notification?.notificationId ?? notification?.id,
  );

  return notificationId ? hiddenIds.includes(notificationId) : false;
}

export function hideArrivalNotificationsLocally(ids = []) {
  const nextIds = ids
    .map(normalizeHiddenArrivalNotificationId)
    .filter(Boolean);

  if (nextIds.length === 0) {
    return [];
  }

  const hiddenIds = new Set(readHiddenArrivalNotificationIds());

  nextIds.forEach((id) => hiddenIds.add(id));
  removeHomeCache(homeCacheKeys.scheduleNotifications);

  return writeHomeCache(
    homeCacheKeys.hiddenArrivalNotifications,
    Array.from(hiddenIds),
  );
}

function formatTwoDigits(value) {
  return String(value ?? 0).padStart(2, "0");
}

function formatTargetArrivalTime(targetArrivalTime) {
  if (!targetArrivalTime) {
    return "";
  }

  if (typeof targetArrivalTime === "string") {
    const [hour, minute] = targetArrivalTime.split(":");

    return hour && minute ? `${hour}:${minute}` : targetArrivalTime;
  }

  const hour = formatTwoDigits(targetArrivalTime.hour);
  const minute = formatTwoDigits(targetArrivalTime.minute);

  return `${hour}:${minute}`;
}

function parseRouteDetails(routeDetails) {
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

function createRouteDescription(notification) {
  const details = notification?.route ?? parseRouteDetails(notification?.routeDetails);
  const origin = details?.origin ?? notification?.origin;
  const destination = details?.destination ?? notification?.destination;
  const originAddress = details?.originAddress;
  const destinationAddress = details?.destinationAddress;

  if (origin && destination) {
    return `${origin} → ${destination}`;
  }

  if (originAddress && destinationAddress) {
    return `${originAddress} → ${destinationAddress}`;
  }

  return notification?.routeDetails ?? "";
}

export function normalizeArrivalNotification(notification) {
  const notificationId = notification?.notificationId ?? notification?.id;
  const routeName = notification?.routeName ?? notification?.title ?? "도착 알림";
  const arrivalTime = formatTargetArrivalTime(notification?.targetArrivalTime);
  const routeDescription = createRouteDescription(notification);
  const isActive =
    notification?.isActive ??
    notification?.active ??
    notification?.enabled ??
    notification?.status === "ACTIVE";
  const timeLabel =
    notification?.timeLabel ||
    arrivalTime ||
    notification?.createdAt ||
    notification?.updatedAt ||
    "";

  return {
    id:
      notificationId === undefined || notificationId === null
        ? undefined
        : `arrival-${notificationId}`,
    notificationId,
    type: notification?.type ?? "success",
    title:
      notification?.title ??
      notification?.message ??
      routeName ??
      "도착 알림",
    description:
      notification?.description ?? notification?.content ?? routeDescription,
    timeLabel,
    routeKey: notification?.routeKey,
    routeName,
    arrivalTime: arrivalTime || "시간 정보 없음",
    targetArrivalTime: notification?.targetArrivalTime,
    reminderOffsetMinutes: notification?.reminderOffsetMinutes,
    repeatDays: notification?.repeatDays ?? [],
    routeDetails: notification?.routeDetails,
    route: notification?.route,
    scheduleType: notification?.scheduleType,
    enabled: Boolean(isActive),
    payload: notification,
    raw: notification,
  };
}

export async function getArrivalNotifications({
  accessToken = getAccessToken(),
  forceRefresh = false,
  signal,
} = {}) {
  if (!forceRefresh) {
    const cachedNotifications = readHomeCache(homeCacheKeys.scheduleNotifications);

    if (cachedNotifications) {
      return cachedNotifications;
    }
  }

  const response = await requestArrivalNotificationJson({
    path: SCHEDULE_NOTIFICATIONS_ENDPOINT,
    method: "GET",
    accessToken,
    signal,
    errorMessage: "도착 알림 목록을 불러오지 못했습니다.",
  });

  return writeHomeCache(
    homeCacheKeys.scheduleNotifications,
    pickArrivalNotificationList(response)
      .filter((notification) => !isHiddenArrivalNotification(notification))
      .map(normalizeArrivalNotification),
  );
}

export async function createArrivalNotification({
  payload,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  const response = await requestArrivalNotificationJson({
    path: SCHEDULE_NOTIFICATIONS_ENDPOINT,
    method: "POST",
    body: {
      ...payload,
      scheduleType: payload?.scheduleType ?? "NORMAL",
    },
    accessToken,
    signal,
    errorMessage: "도착 알림 등록에 실패했습니다.",
  });

  removeHomeCache(homeCacheKeys.scheduleNotifications);
  await getArrivalNotifications({ accessToken, forceRefresh: true, signal }).catch(() => null);

  return response;
}

export async function deleteArrivalNotifications({
  ids,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error("삭제할 도착 알림 id가 필요합니다.");
  }

  const response = await requestArrivalNotificationJson({
    path: buildArrivalNotificationsDeleteEndpoint(ids),
    method: "DELETE",
    accessToken,
    signal,
    errorMessage: "도착 알림 삭제에 실패했습니다.",
  });

  removeHomeCache(homeCacheKeys.scheduleNotifications);
  await getArrivalNotifications({ accessToken, forceRefresh: true, signal }).catch(() => null);

  return response;
}

function getScheduleNotificationCacheId(notification) {
  return String(notification?.notificationId ?? notification?.id ?? "").replace(/^arrival-/, "");
}

function updateScheduleNotificationsCache(id, updater) {
  const cachedNotifications = readHomeCache(homeCacheKeys.scheduleNotifications);
  const normalizedId = String(id);

  if (!Array.isArray(cachedNotifications)) {
    return;
  }

  writeHomeCache(
    homeCacheKeys.scheduleNotifications,
    cachedNotifications.map((notification) =>
      getScheduleNotificationCacheId(notification) === normalizedId
        ? updater(notification)
        : notification,
    ),
  );
}

export async function getArrivalNotificationById({
  id,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  if (id === undefined || id === null || id === "") {
    throw new Error("도착 알림 id가 필요합니다.");
  }

  const response = await requestArrivalNotificationJson({
    path: buildArrivalNotificationEndpoint(id),
    method: "GET",
    accessToken,
    signal,
    errorMessage: "도착 알림을 불러오지 못했습니다.",
  });

  const notification = response?.data ?? response;

  return normalizeArrivalNotification(notification);
}

export async function updateArrivalNotification({
  id,
  payload,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  if (id === undefined || id === null || id === "") {
    throw new Error("도착 알림 id가 필요합니다.");
  }

  const response = await requestArrivalNotificationJson({
    path: buildArrivalNotificationEndpoint(id),
    method: "PATCH",
    body: payload,
    accessToken,
    signal,
    errorMessage: "도착 알림 수정에 실패했습니다.",
  });

  updateScheduleNotificationsCache(id, (notification) =>
    normalizeArrivalNotification({
      ...notification.raw,
      ...notification.payload,
      ...payload,
      notificationId: notification.notificationId ?? id,
      id: notification.notificationId ?? id,
    }),
  );

  return response;
}

export function saveArrivalNotification(options = {}) {
  const { id } = options;
  return id !== undefined && id !== null && id !== ""
    ? updateArrivalNotification(options)
    : createArrivalNotification(options);
}

export async function updateArrivalNotificationStatus({
  id,
  payload,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  if (id === undefined || id === null || id === "") {
    throw new Error("도착 알림 id가 필요합니다.");
  }

  const nextActive =
    payload?.isActive ?? payload?.active ?? payload?.enabled ?? payload?.status === "ACTIVE";

  const response = await requestArrivalNotificationJson({
    path: buildArrivalNotificationStatusEndpoint(id),
    method: "PATCH",
    body: payload,
    accessToken,
    signal,
    errorMessage: "도착 알림 상태 변경에 실패했습니다.",
  });

  updateScheduleNotificationsCache(id, (notification) => ({
    ...notification,
    enabled: Boolean(nextActive),
    raw: {
      ...notification.raw,
      ...payload,
      isActive: Boolean(nextActive),
      active: Boolean(nextActive),
    },
    payload: {
      ...notification.payload,
      ...payload,
      isActive: Boolean(nextActive),
      active: Boolean(nextActive),
    },
  }));

  return response;
}
