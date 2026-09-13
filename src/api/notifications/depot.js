import { getAccessToken } from "../auth/tokens";
import { reissueAuthTokens } from "../auth/reissue";
import { requestJson } from "../client";

const DEPOT_NOTIFICATIONS_ENDPOINT = "/api/notifications/depot";
const MY_DEPOT_NOTIFICATIONS_ENDPOINT = "/api/notifications/depot/my";

function buildDepotNotificationEndpoint(userBusId) {
  return `${DEPOT_NOTIFICATIONS_ENDPOINT}/${encodeURIComponent(userBusId)}`;
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

async function requestDepotNotificationJson(options) {
  const fallbackMessage =
    options.errorMessage ?? "차고지 출발 알림 요청에 실패했습니다.";

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

function pickDepotNotificationList(response) {
  const data = response?.data ?? response;

  return Array.isArray(data) ? data : [];
}

export function normalizeDepotNotification(notification) {
  const userBusId = notification?.userBusId;
  const busNumber = notification?.busNumber ?? "";
  const directionName = notification?.directionName ?? "";

  return {
    id: userBusId,
    userBusId,
    routeId: notification?.routeId,
    direction: directionName || notification?.direction || "방면 정보 없음",
    directionType: notification?.direction ?? "",
    routeNumber: busNumber,
    routeName: busNumber ? `${busNumber}번` : "버스 정보 없음",
    enabled: Boolean(notification?.active),
    raw: notification,
  };
}

export async function createDepotNotification({
  payload,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  return requestDepotNotificationJson({
    path: DEPOT_NOTIFICATIONS_ENDPOINT,
    method: "POST",
    body: payload,
    accessToken,
    signal,
    errorMessage: "차고지 출발 알림 등록에 실패했습니다.",
  });
}

export async function getMyDepotNotifications({
  accessToken = getAccessToken(),
  signal,
} = {}) {
  const response = await requestDepotNotificationJson({
    path: MY_DEPOT_NOTIFICATIONS_ENDPOINT,
    method: "GET",
    accessToken,
    signal,
    errorMessage: "차고지 출발 알림 목록을 불러오지 못했습니다.",
  });

  return pickDepotNotificationList(response).map(normalizeDepotNotification);
}

export async function deleteDepotNotification({
  userBusId,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  if (userBusId === undefined || userBusId === null || userBusId === "") {
    throw new Error("사용자 버스 id가 필요합니다.");
  }

  return requestDepotNotificationJson({
    path: buildDepotNotificationEndpoint(userBusId),
    method: "DELETE",
    accessToken,
    signal,
    errorMessage: "차고지 출발 알림 삭제에 실패했습니다.",
  });
}
