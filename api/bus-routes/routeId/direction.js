/*
  버스 노선 방향 조회 API

  GET /api/bus-routes/{routeId}/directions

  성공 응답:
  {
    "code": "SUCCESS",
    "message": "요청이 성공적으로 처리되었습니다.",
    "data": {
      "depotEnum": "DEPOT",
      "depotName": "우이동 방면",
      "routeId": "100100006",
      "routeNm": "101",
      "term": "8",
      "turnaroundEnum": "TURNAROUND",
      "turnaroundName": "서소문 방면"
    }
  }

  에러 응답:
  400 C002 해당 노선을 찾을 수 없습니다.
  401 C007 인증이 필요합니다.
*/
import { getAccessToken } from "../../auth/tokens";
import { requestJson } from "../../client";

export const BUS_ROUTE_DIRECTIONS_ENDPOINT = "/api/bus-routes";

export function normalizeBusRouteDirections(directionData) {
  const routeId = directionData?.routeId ?? "";
  const routeName = directionData?.routeNm ?? "";
  const term = directionData?.term ?? "";
  const depotEnum = directionData?.depotEnum ?? "DEPOT";
  const turnaroundEnum = directionData?.turnaroundEnum ?? "TURNAROUND";
  const depotName = directionData?.depotName ?? "";
  const turnaroundName = directionData?.turnaroundName ?? "";

  return {
    routeId,
    routeName,
    routeNm: routeName,
    term,
    depotEnum,
    depotName,
    turnaroundEnum,
    turnaroundName,
    directions: [
      {
        id: depotEnum,
        directionEnum: depotEnum,
        title: depotName,
        name: depotName,
      },
      {
        id: turnaroundEnum,
        directionEnum: turnaroundEnum,
        title: turnaroundName,
        name: turnaroundName,
      },
    ].filter((direction) => direction.title),
  };
}

export async function getBusRouteDirections({
  routeId,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  const normalizedRouteId = String(routeId ?? "").trim();

  if (!normalizedRouteId) {
    const error = new Error("노선 ID를 입력해주세요.");

    error.status = 400;
    error.code = "C002";

    throw error;
  }

  const response = await requestJson({
    path: `${BUS_ROUTE_DIRECTIONS_ENDPOINT}/${encodeURIComponent(
      normalizedRouteId,
    )}/directions`,
    method: "GET",
    accessToken,
    signal,
    errorMessage: "버스 방향 정보를 불러오지 못했습니다.",
  });

  return {
    ...response,
    data: normalizeBusRouteDirections(response?.data),
  };
}
