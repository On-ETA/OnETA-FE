import { getAccessToken } from "../auth/tokens";
import { requestJson } from "../client";

const DEPOT_NOTIFICATIONS_ENDPOINT = "/api/notifications/depot";
const MY_DEPOT_NOTIFICATIONS_ENDPOINT = "/api/notifications/depot/my";

function buildDepotNotificationEndpoint(userBusId) {
  return `${DEPOT_NOTIFICATIONS_ENDPOINT}/${encodeURIComponent(userBusId)}`;
}

export async function createDepotNotification({
  payload,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  return requestJson({
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
  return requestJson({
    path: MY_DEPOT_NOTIFICATIONS_ENDPOINT,
    method: "GET",
    accessToken,
    signal,
    errorMessage: "차고지 출발 알림 목록을 불러오지 못했습니다.",
  });
}

export async function deleteDepotNotification({
  userBusId,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  if (userBusId === undefined || userBusId === null || userBusId === "") {
    throw new Error("사용자 버스 id가 필요합니다.");
  }

  return requestJson({
    path: buildDepotNotificationEndpoint(userBusId),
    method: "DELETE",
    accessToken,
    signal,
    errorMessage: "차고지 출발 알림 삭제에 실패했습니다.",
  });
}
