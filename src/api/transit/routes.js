import { getAccessToken } from "../auth/tokens";
import { reissueAuthTokens } from "../auth/reissue";
import { requestJson } from "../client";
import {
  homeCacheKeys,
  readHomeCacheAsync,
  writeHomeCacheAsync,
} from "../homeCache";

const TRANSIT_ROUTES_SEARCH_ENDPOINT = "/api/transit/routes/search";
const FIRST_LAST_ROUTES_SEARCH_ENDPOINT = "/api/transit/routes/first-last/search";
const TRANSIT_ROUTE_CACHE_TTL_MS = 5 * 60 * 1000;
const FIRST_LAST_ROUTE_CACHE_TTL_MS = 60 * 1000;

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

async function requestTransitRouteJson(options) {
  const fallbackMessage =
    options.errorMessage ?? "대중교통 경로 검색에 실패했습니다.";

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

function normalizeStation(station) {
  return {
    name: station?.name ?? "",
    sequence: station?.sequence,
    stationId: station?.stationId,
    x: station?.x,
    y: station?.y,
    arsId: station?.arsId,
    raw: station,
  };
}

function normalizeTransitType(segment) {
  const type = String(
    segment?.transitType ?? segment?.type ?? segment?.mode ?? "",
  ).toUpperCase();

  return ["WALK", "WALKING", "FOOT", "PEDESTRIAN"].includes(type)
    ? "WALK"
    : segment?.transitType ?? type;
}

function getDurationMinutes(segment) {
  const value =
    segment?.durationMinutes ??
    segment?.walkTime ??
    segment?.walkingTime ??
    segment?.walkDurationMinutes ??
    segment?.walkDuration ??
    segment?.duration ??
    segment?.time;
  const number = Number(value);

  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

function normalizeSegment(segment, index) {
  return {
    id: `${segment?.transitType ?? "segment"}-${index}`,
    transitType: normalizeTransitType(segment),
    startStation: segment?.startStation ?? "",
    endStation: segment?.endStation ?? "",
    durationMinutes: getDurationMinutes(segment),
    transitName: segment?.transitName ?? "",
    nightBus: Boolean(segment?.nightBus),
    stations: Array.isArray(segment?.stations)
      ? segment.stations.map(normalizeStation)
      : [],
    scheduledWaitMinutes: segment?.scheduledWaitMinutes,
    realTimeArrivalSeconds: segment?.realTimeArrivalSeconds,
    realTimeSource: segment?.realTimeSource,
    raw: segment,
  };
}

export function normalizeTransitRoute(result) {
  const route = result?.route ?? result;
  const segments = Array.isArray(route?.segments)
    ? route.segments.map(normalizeSegment)
    : [];

  return {
    routeId: route?.routeId,
    originAddress: route?.originAddress ?? "",
    destinationAddress: route?.destinationAddress ?? "",
    totalDurationMinutes: route?.totalDurationMinutes ?? 0,
    realTimeDurationMinutes: route?.realTimeDurationMinutes,
    totalCost: route?.totalCost,
    transferCount: route?.transferCount ?? 0,
    scheduleType: result?.scheduleType ?? route?.scheduleType,
    status: result?.status ?? route?.status ?? "AVAILABLE",
    estimatedDepartureAt: result?.estimatedDepartureAt ?? route?.estimatedDepartureAt,
    segments,
    raw: route,
  };
}

async function searchRoutes(endpoint, cacheTtlMs, {
  originX,
  originY,
  originAddress,
  destX,
  destY,
  destAddress,
  scheduleType,
  params,
  accessToken = getAccessToken(),
  forceRefresh = false,
  signal,
} = {}) {
  const queryParams = {
    originX,
    originY,
    originAddress,
    destX,
    destY,
    destAddress,
    ...params,
    scheduleType: scheduleType ?? params?.scheduleType,
  };
  const queryString = toQueryString(queryParams);
  const requestPath = `${endpoint}${queryString}`;

  if (!forceRefresh) {
    const cachedSearches = await readHomeCacheAsync(
      homeCacheKeys.transitRouteSearch,
      null,
    );
    const cached = cachedSearches?.searches?.[requestPath];

    if (
      cached &&
      cached.version === 2 &&
      Date.now() - cached.savedAt < cacheTtlMs &&
      Array.isArray(cached.routes)
    ) {
      return cached.routes;
    }
  }

  const response = await requestTransitRouteJson({
    path: requestPath,
    method: "GET",
    accessToken,
    signal,
    errorMessage: "대중교통 경로 검색에 실패했습니다.",
  });
  const data = response?.data ?? response;
  const routes = Array.isArray(data) ? data : data?.routes;

  const normalizedRoutes = Array.isArray(routes)
    ? routes.map(normalizeTransitRoute)
    : [];

  const cachedSearches = await readHomeCacheAsync(
    homeCacheKeys.transitRouteSearch,
    null,
  );
  const searches =
    cachedSearches?.searches && typeof cachedSearches.searches === "object"
      ? { ...cachedSearches.searches }
      : {};
  searches[requestPath] = {
    version: 2,
    savedAt: Date.now(),
    ttlMs: cacheTtlMs,
    routes: normalizedRoutes,
  };

  const recentSearches = Object.entries(searches)
    .filter(([, entry]) =>
      Date.now() - entry.savedAt < (entry.ttlMs ?? TRANSIT_ROUTE_CACHE_TTL_MS),
    )
    .sort(([, first], [, second]) => second.savedAt - first.savedAt)
    .slice(0, 8);

  await writeHomeCacheAsync(homeCacheKeys.transitRouteSearch, {
    searches: Object.fromEntries(recentSearches),
  });

  return normalizedRoutes;
}

export function searchTransitRoutes(options = {}) {
  return searchRoutes(TRANSIT_ROUTES_SEARCH_ENDPOINT, TRANSIT_ROUTE_CACHE_TTL_MS, options);
}

export function searchFirstLastTransitRoutes(options = {}) {
  if (!options.scheduleType) {
    return Promise.reject(new Error("첫차·막차 경로 조회에는 scheduleType이 필요합니다."));
  }

  return searchRoutes(FIRST_LAST_ROUTES_SEARCH_ENDPOINT, FIRST_LAST_ROUTE_CACHE_TTL_MS, options);
}
