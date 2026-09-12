import { getAccessToken } from "./auth/tokens";
import { reissueAuthTokens } from "./auth/reissue";
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

function pickBusRouteList(response) {
  const data = response?.data ?? response;

  if (Array.isArray(data)) {
    return data;
  }

  if (!data || typeof data !== "object") {
    return [];
  }

  const candidates = [
    data.routes,
    data.routeList,
    data.busRoutes,
    data.busRouteList,
    data.items,
    data.content,
    data.result,
    data.results,
  ];

  return candidates.find(Array.isArray) ?? [];
}

export function normalizeBusRoute(route, fallbackQuery = "") {
  const routeId = route?.routeId ?? route?.id ?? route?.busRouteId;
  const routeName =
    route?.routeNm ??
    route?.routeName ??
    route?.name ??
    route?.busNumber ??
    (fallbackQuery ? `${fallbackQuery}번` : "노선 정보 없음");
  const startPoint = route?.startPoint ?? route?.start ?? route?.origin ?? "";
  const endPoint = route?.endPoint ?? route?.end ?? route?.destination ?? "";
  const interval =
    route?.term ?? route?.interval ?? route?.dispatchInterval ?? "";
  const routePath =
    route?.route ??
    route?.description ??
    route?.direction ??
    route?.stationNames ??
    [startPoint, endPoint].filter(Boolean).join(" - ");

  return {
    id: routeId ?? `${routeName}-${startPoint}-${endPoint}`,
    routeId,
    name: routeName,
    interval,
    route: routePath,
    startPoint,
    endPoint,
    directions: route?.directions ?? route?.directionList ?? [
      {
        id: `${routeId ?? routeName}-direction`,
        title: `${endPoint || "도착지"} 방면`,
        description: `${startPoint || "출발지"} 출발 · ${
          endPoint || "도착지"
        } 도착`,
      },
    ],
    raw: route,
  };
}

export function normalizeBusRouteDirections(direction) {
  const data = direction?.data ?? direction ?? {};
  const routeId = data.routeId;
  const routeName = data.routeNm ?? data.routeName ?? data.name ?? "";
  const interval =
    data.term ?? data.interval ?? data.dispatchInterval ?? "";

  return {
    id: routeId ?? routeName,
    routeId,
    name: routeName,
    interval,
    route: [data.depotName, data.turnaroundName].filter(Boolean).join(" - "),
    depotName: data.depotName ?? "",
    depotEnum: data.depotEnum ?? "",
    turnaroundName: data.turnaroundName ?? "",
    turnaroundEnum: data.turnaroundEnum ?? "",
    directions: [
      {
        id: data.depotEnum ?? "DEPOT",
        type: data.depotEnum ?? "DEPOT",
        title: `${data.depotName ?? "차고지"} 방면`,
        description: "차고지에서 출발하는 방향입니다.",
      },
      {
        id: data.turnaroundEnum ?? "TURNAROUND",
        type: data.turnaroundEnum ?? "TURNAROUND",
        title: `${data.turnaroundName ?? "회차지"} 방면`,
        description: "회차지에서 돌아오는 방향입니다.",
      },
    ],
    raw: data,
  };
}

async function requestBusRouteJson(options) {
  const fallbackMessage = options.errorMessage ?? "버스 API 요청에 실패했습니다.";

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

export async function searchBusRoutes({
  keyword,
  query,
  params,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  const searchQuery = query ?? keyword;
  const response = await requestBusRouteJson({
    path: `${BUS_ROUTES_SEARCH_ENDPOINT}${toQueryString({
      query: searchQuery,
      ...params,
    })}`,
    method: "GET",
    accessToken,
    signal,
    errorMessage: "버스 노선 검색에 실패했습니다.",
  });

  return pickBusRouteList(response).map((route) =>
    normalizeBusRoute(route, searchQuery),
  );
}

export async function getBusRouteDirections({
  routeId,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  if (routeId === undefined || routeId === null || routeId === "") {
    throw new Error("버스 노선 id가 필요합니다.");
  }

  const response = await requestBusRouteJson({
    path: buildBusRouteDirectionsEndpoint(routeId),
    method: "GET",
    accessToken,
    signal,
    errorMessage: "버스 노선 방향 정보를 불러오지 못했습니다.",
  });

  return normalizeBusRouteDirections(response);
}

export async function getBusRouteLocations({
  routeId,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  if (routeId === undefined || routeId === null || routeId === "") {
    throw new Error("버스 노선 id가 필요합니다.");
  }

  return requestBusRouteJson({
    path: buildBusRouteLocationsEndpoint(routeId),
    method: "GET",
    accessToken,
    signal,
    errorMessage: "버스 위치 정보를 불러오지 못했습니다.",
  });
}
