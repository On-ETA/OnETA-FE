import { getAccessToken } from "./auth/tokens";
import { requestJson } from "./client";

const BUS_ROUTES_SEARCH_ENDPOINT = "/api/bus-routes/search";

function buildBusRouteDirectionsEndpoint(routeId) {
  return `/api/bus-routes/${encodeURIComponent(routeId)}/directions`;
}

function buildBusRouteLocationsEndpoint(routeId) {
  return `/api/bus-routes/${encodeURIComponent(routeId)}/locations`;
}

function toQueryString(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.append(key, value);
    }
  });

  const queryString = query.toString();

  return queryString ? `?${queryString}` : "";
}

export async function searchBusRoutes({
  keyword,
  params,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  return requestJson({
    path: `${BUS_ROUTES_SEARCH_ENDPOINT}${toQueryString({
      keyword,
      query: keyword,
      ...params,
    })}`,
    method: "GET",
    accessToken,
    signal,
    errorMessage: "버스 노선 검색에 실패했습니다.",
  });
}

export async function getBusRouteDirections({
  routeId,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  if (routeId === undefined || routeId === null || routeId === "") {
    throw new Error("버스 노선 id가 필요합니다.");
  }

  return requestJson({
    path: buildBusRouteDirectionsEndpoint(routeId),
    method: "GET",
    accessToken,
    signal,
    errorMessage: "버스 노선 방향 정보를 불러오지 못했습니다.",
  });
}

export async function getBusRouteLocations({
  routeId,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  if (routeId === undefined || routeId === null || routeId === "") {
    throw new Error("버스 노선 id가 필요합니다.");
  }

  return requestJson({
    path: buildBusRouteLocationsEndpoint(routeId),
    method: "GET",
    accessToken,
    signal,
    errorMessage: "버스 위치 정보를 불러오지 못했습니다.",
  });
}
