/*
  차고지 출발 알림 버스 검색 API

  GET /api/bus-routes/search?query=101

  성공 응답:
  {
    "code": "SUCCESS",
    "message": "요청이 성공적으로 처리되었습니다.",
    "data": [
      {
        "endPoint": "서소문",
        "routeId": "100100006",
        "routeNm": "101",
        "startPoint": "우이동",
        "term": "8"
      }
    ]
  }

  에러 응답:
  400 C002 검색어를 입력해주세요.
  401 C007 인증이 필요합니다.
*/
import { getAccessToken } from "../auth/tokens";
import { requestJson } from "../client";

export const BUS_ROUTE_SEARCH_ENDPOINT = "/api/bus-routes/search";

export function normalizeBusRoute(route) {
  return {
    routeId: route?.routeId ?? "",
    routeName: route?.routeNm ?? "",
    routeNm: route?.routeNm ?? "",
    startPoint: route?.startPoint ?? "",
    endPoint: route?.endPoint ?? "",
    term: route?.term ?? "",
  };
}

export async function searchBusRoutes({
  query,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  const trimmedQuery = String(query ?? "").trim();

  if (!trimmedQuery) {
    const error = new Error("검색어를 입력해주세요.");

    error.status = 400;
    error.code = "C002";

    throw error;
  }

  const searchParams = new URLSearchParams({ query: trimmedQuery });
  const response = await requestJson({
    path: `${BUS_ROUTE_SEARCH_ENDPOINT}?${searchParams.toString()}`,
    method: "GET",
    accessToken,
    signal,
    errorMessage: "버스 검색에 실패했습니다.",
  });

  return {
    ...response,
    data: Array.isArray(response?.data)
      ? response.data.map(normalizeBusRoute)
      : [],
  };
}
