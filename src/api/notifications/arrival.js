import { getAccessToken } from "../auth/tokens";
import { requestJson } from "../client";

const ARRIVAL_NOTIFICATIONS_ENDPOINT = "/api/notifications/arrival";

function buildArrivalNotificationEndpoint(id) {
  return `${ARRIVAL_NOTIFICATIONS_ENDPOINT}/${encodeURIComponent(id)}`;
}

function buildArrivalNotificationStatusEndpoint(id) {
  return `${buildArrivalNotificationEndpoint(id)}/status`;
}

export function normalizeArrivalNotification(notification) {
  return {
    id: notification?.id,
    type: notification?.type ?? "success",
    title:
      notification?.title ??
      notification?.message ??
      notification?.routeName ??
      "도착 알림",
    description: notification?.description ?? notification?.content ?? "",
    timeLabel:
      notification?.timeLabel ??
      notification?.createdAt ??
      notification?.updatedAt ??
      "",
    routeKey: notification?.routeKey,
    payload: notification,
  };
}

export async function getArrivalNotifications({
  accessToken = getAccessToken(),
  signal,
} = {}) {
  const response = await requestJson({
    path: ARRIVAL_NOTIFICATIONS_ENDPOINT,
    method: "GET",
    accessToken,
    signal,
    errorMessage: "도착 알림 목록을 불러오지 못했습니다.",
  });

  const notifications = Array.isArray(response?.data)
    ? response.data
    : response;

  return Array.isArray(notifications)
    ? notifications.map(normalizeArrivalNotification)
    : [];
}

export async function createArrivalNotification({
  payload,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  return requestJson({
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
  return requestJson({
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

  return requestJson({
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

  return requestJson({
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

  return requestJson({
    path: buildArrivalNotificationStatusEndpoint(id),
    method: "PATCH",
    body: payload,
    accessToken,
    signal,
    errorMessage: "도착 알림 상태 변경에 실패했습니다.",
  });
}
