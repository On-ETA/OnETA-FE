import { getAccessToken } from "../auth/tokens";
import { reissueAuthTokens } from "../auth/reissue";
import { requestJson } from "../client";

const ARRIVAL_NOTIFICATIONS_ENDPOINT = "/api/notifications/arrival";

function buildArrivalNotificationEndpoint(id) {
  return `${ARRIVAL_NOTIFICATIONS_ENDPOINT}/${encodeURIComponent(id)}`;
}

function buildArrivalNotificationStatusEndpoint(id) {
  return `${buildArrivalNotificationEndpoint(id)}/status`;
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

    try {
      const { accessToken } = await reissueAuthTokens({
        signal: options.signal,
      });
      const response = await requestJson({
        ...options,
        accessToken,
      });
      const businessError = createBusinessError(response, fallbackMessage);

      if (businessError) {
        throw businessError;
      }

      return response;
    } catch {
      throw error;
    }
  }
}

function pickArrivalNotificationList(response) {
  const data = response?.data ?? response;

  return Array.isArray(data) ? data : [];
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
  const details = parseRouteDetails(notification?.routeDetails);
  const origin = details?.origin ?? notification?.origin;
  const destination = details?.destination ?? notification?.destination;

  if (origin && destination) {
    return `${origin} → ${destination}`;
  }

  return notification?.routeDetails ?? "";
}

export function normalizeArrivalNotification(notification) {
  const notificationId = notification?.notificationId ?? notification?.id;
  const routeName = notification?.routeName ?? notification?.title ?? "도착 알림";
  const arrivalTime = formatTargetArrivalTime(notification?.targetArrivalTime);
  const routeDescription = createRouteDescription(notification);
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
    scheduleType: notification?.scheduleType,
    enabled: Boolean(notification?.isActive),
    payload: notification,
    raw: notification,
  };
}

export async function getArrivalNotifications({
  accessToken = getAccessToken(),
  signal,
} = {}) {
  const response = await requestArrivalNotificationJson({
    path: ARRIVAL_NOTIFICATIONS_ENDPOINT,
    method: "GET",
    accessToken,
    signal,
    errorMessage: "도착 알림 목록을 불러오지 못했습니다.",
  });

  return pickArrivalNotificationList(response).map(normalizeArrivalNotification);
}

export async function createArrivalNotification({
  payload,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  return requestArrivalNotificationJson({
    path: ARRIVAL_NOTIFICATIONS_ENDPOINT,
    method: "POST",
    body: payload,
    accessToken,
    signal,
    errorMessage: "도착 알림 등록에 실패했습니다.",
  });
}

export async function deleteArrivalNotifications({
  payload,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  return requestArrivalNotificationJson({
    path: ARRIVAL_NOTIFICATIONS_ENDPOINT,
    method: "DELETE",
    body: payload,
    accessToken,
    signal,
    errorMessage: "도착 알림 삭제에 실패했습니다.",
  });
}

export async function getArrivalNotificationById({
  id,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  if (id === undefined || id === null || id === "") {
    throw new Error("도착 알림 id가 필요합니다.");
  }

  return requestArrivalNotificationJson({
    path: buildArrivalNotificationEndpoint(id),
    method: "GET",
    accessToken,
    signal,
    errorMessage: "도착 알림을 불러오지 못했습니다.",
  });
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

  return requestArrivalNotificationJson({
    path: buildArrivalNotificationEndpoint(id),
    method: "PATCH",
    body: payload,
    accessToken,
    signal,
    errorMessage: "도착 알림 수정에 실패했습니다.",
  });
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

  return requestArrivalNotificationJson({
    path: buildArrivalNotificationStatusEndpoint(id),
    method: "PATCH",
    body: payload,
    accessToken,
    signal,
    errorMessage: "도착 알림 상태 변경에 실패했습니다.",
  });
}
