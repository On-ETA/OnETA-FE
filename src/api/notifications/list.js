import { getAccessToken } from "../auth/tokens";
import { reissueAuthTokens } from "../auth/reissue";
import { requestJson } from "../client";

const NOTIFICATIONS_ENDPOINT = "/api/notifications";

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

async function requestNotificationJson(options) {
  const fallbackMessage =
    options.errorMessage ?? "알림 목록을 불러오지 못했습니다.";

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

function pickNotificationList(response) {
  const data = response?.data ?? response;

  if (Array.isArray(data)) {
    return data;
  }

  if (!data || typeof data !== "object") {
    return [];
  }

  const candidates = [
    data.notifications,
    data.notificationList,
    data.items,
    data.content,
    data.results,
    data.result,
  ];

  return candidates.find(Array.isArray) ?? [];
}

function formatRelativeTime(value) {
  if (!value) {
    return "";
  }

  if (typeof value !== "string") {
    return String(value);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {
    return "방금";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}분 전`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}시간 전`;
  }

  const diffDays = Math.floor(diffHours / 24);

  if (diffDays === 1) {
    return "어제";
  }

  if (diffDays < 7) {
    return `${diffDays}일 전`;
  }

  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function pickNotificationType(notification) {
  const type = notification?.type ?? notification?.notificationType;
  const status = notification?.status;
  const severity = notification?.severity;

  if (
    type === "danger" ||
    type === "warning" ||
    status === "danger" ||
    status === "warning" ||
    severity === "danger" ||
    severity === "warning"
  ) {
    return "danger";
  }

  return "success";
}

export function normalizeNotification(notification, index = 0) {
  const id =
    notification?.notificationId ??
    notification?.id ??
    notification?.alarmId ??
    `notification-${index}`;
  const createdAt =
    notification?.createdAt ??
    notification?.sentAt ??
    notification?.receivedAt ??
    notification?.updatedAt;

  return {
    id,
    type: pickNotificationType(notification),
    title:
      notification?.title ??
      notification?.message ??
      notification?.body ??
      "알림",
    description:
      notification?.description ??
      notification?.content ??
      notification?.subMessage ??
      "",
    timeLabel:
      notification?.timeLabel ??
      notification?.relativeTime ??
      formatRelativeTime(createdAt),
    routeKey: notification?.routeKey,
    payload: notification?.payload ?? notification,
    raw: notification,
  };
}

export async function getNotifications({
  accessToken = getAccessToken(),
  signal,
} = {}) {
  const response = await requestNotificationJson({
    path: NOTIFICATIONS_ENDPOINT,
    method: "GET",
    accessToken,
    signal,
    errorMessage: "알림 목록을 불러오지 못했습니다.",
  });

  return pickNotificationList(response).map(normalizeNotification);
}
