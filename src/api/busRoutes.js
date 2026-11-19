import { getAccessToken, getAuthSessionId } from "./auth/tokens";
import { reissueAuthTokens } from "./auth/reissue";
import { requestJson } from "./client";
import { homeCacheKeys, readHomeCache, readHomeCacheAsync, writeHomeCache } from "./homeCache";
import { isSameData } from "../utils/isSameData";

const DIRECTIONS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHED_DIRECTIONS = 50;
let directionsRequestSequence = 0;
const latestDirectionsRequests = new Map();

export function getCachedBusRouteDirections(routeId) {
  if (routeId === undefined || routeId === null || routeId === "") return null;
  const entry = readHomeCache(homeCacheKeys.busRouteDirections, {})?.[String(routeId)];
  return entry?.expiresAt > Date.now() && String(entry.value?.routeId) === String(routeId)
    && Array.isArray(entry.value?.directions) && entry.value.directions.length > 0
    ? entry.value : null;
}

export async function getCachedBusRouteDirectionsAsync(routeId) {
  await readHomeCacheAsync(homeCacheKeys.busRouteDirections, {});
  return getCachedBusRouteDirections(routeId);
}

function directionsAbortError() {
  return Object.assign(new Error("방면 정보 요청이 취소되었습니다."), { name: "AbortError" });
}

const BUS_ROUTES_SEARCH_ENDPOINT = "/api/bus-routes/search";

function buildBusRouteDirectionsEndpoint(routeId) {
  return `/api/bus-routes/${encodeURIComponent(routeId)}/directions`;
}

function buildBusRouteLocationsEndpoint(routeId) {
  return `/api/bus-routes/${encodeURIComponent(routeId)}/locations`;
}

function normalizeDirectionName(name, fallback) {
  return String(name ?? fallback)
    .replace(/\s*방면\s*$/, "")
    .trim();
}

function formatDirectionTitle(name, fallback) {
  const directionName = normalizeDirectionName(name, fallback);

  return `${directionName || fallback} 방면`;
}

function formatDepartureDescription(name, fallback) {
  const stationName = normalizeDirectionName(name, fallback)
    .replace(/\s*정류장\s*$/, "")
    .trim();

  return `${stationName || fallback} 정류장에서 출고 시 1회 알림`;
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
        title: formatDirectionTitle(data.depotName, "차고지"),
        description: formatDepartureDescription(data.depotName, "차고지"),
      },
      {
        id: data.turnaroundEnum ?? "TURNAROUND",
        type: data.turnaroundEnum ?? "TURNAROUND",
        title: formatDirectionTitle(data.turnaroundName, "회차지"),
        description: formatDepartureDescription(data.turnaroundName, "회차지"),
      },
    ],
    raw: data,
  };
}

export function normalizeBusRouteLocations(locations) {
  const data = locations?.data ?? locations ?? {};
  const activeBuses = Array.isArray(data.activeBuses)
    ? data.activeBuses.map((bus, index) => ({
        id: `${bus?.plainNo ?? "bus"}-${bus?.sectOrd ?? index}`,
        atStop: Boolean(bus?.atStop),
        depotDeparted: Boolean(bus?.depotDeparted),
        plainNo: bus?.plainNo ?? "",
        sectOrd: bus?.sectOrd,
        raw: bus,
      }))
    : [];

  return {
    routeId: data.routeId,
    depotDeparted: Boolean(data.depotDeparted),
    depotDepartedBusNo: data.depotDepartedBusNo ?? "",
    turnaroundDeparted: Boolean(data.turnaroundDeparted),
    turnaroundDepartedBusNo: data.turnaroundDepartedBusNo ?? "",
    activeBuses,
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
  forceRefresh = false,
} = {}) {
  if (routeId === undefined || routeId === null || routeId === "") {
    throw new Error("버스 노선 id가 필요합니다.");
  }

  const sessionId = getAuthSessionId();
  if (signal?.aborted) throw directionsAbortError();
  if (!forceRefresh) {
    const cached = await getCachedBusRouteDirectionsAsync(routeId);
    if (signal?.aborted || sessionId !== getAuthSessionId()) throw directionsAbortError();
    if (cached) return cached;
  }

  const requestKey = String(routeId);
  const requestId = ++directionsRequestSequence;
  latestDirectionsRequests.set(requestKey, requestId);

  try {
    const response = await requestBusRouteJson({
      path: buildBusRouteDirectionsEndpoint(routeId),
      method: "GET",
      accessToken,
      signal,
      errorMessage: "버스 노선 방향 정보를 불러오지 못했습니다.",
    });

    if (signal?.aborted || sessionId !== getAuthSessionId()
      || latestDirectionsRequests.get(requestKey) !== requestId) throw directionsAbortError();

    const value = normalizeBusRouteDirections(response);
    value.routeId ??= routeId;
    if (String(value.routeId) !== requestKey) {
      throw new Error("버스 방면 정보가 올바르지 않습니다.");
    }
    // Preserve partial responses for the existing UI, but do not persist
    // fallback labels in place of previously complete direction metadata.
    if (!value.depotName || !value.turnaroundName) return value;
    const now = Date.now();
    const cached = getCachedBusRouteDirections(routeId);
    const result = isSameData(cached, value) ? cached : value;
    const entries = Object.entries(readHomeCache(homeCacheKeys.busRouteDirections, {}) ?? {})
      .filter(([key, entry]) => key !== requestKey && entry?.expiresAt > now)
      .sort((a, b) => b[1].expiresAt - a[1].expiresAt)
      .slice(0, MAX_CACHED_DIRECTIONS - 1);
    writeHomeCache(homeCacheKeys.busRouteDirections, {
      ...Object.fromEntries(entries),
      [requestKey]: { expiresAt: now + DIRECTIONS_CACHE_TTL_MS, value: result },
    });
    return result;
  } finally {
    if (latestDirectionsRequests.get(requestKey) === requestId) latestDirectionsRequests.delete(requestKey);
  }
}

export async function getBusRouteLocations({
  routeId,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  if (routeId === undefined || routeId === null || routeId === "") {
    throw new Error("버스 노선 id가 필요합니다.");
  }

  const response = await requestBusRouteJson({
    path: buildBusRouteLocationsEndpoint(routeId),
    method: "GET",
    accessToken,
    signal,
    errorMessage: "버스 위치 정보를 불러오지 못했습니다.",
  });

  return normalizeBusRouteLocations(response);
}
