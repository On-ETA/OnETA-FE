import { getAccessToken } from "../auth/tokens";
import { reissueAuthTokens } from "../auth/reissue";
import { requestJson } from "../client";
import {
  homeCacheKeys,
  readHomeCacheAsync,
  writeHomeCacheAsync,
} from "../homeCache";

const TRANSIT_ROUTES_SEARCH_ENDPOINT = "/api/transit/routes/search";
const FIRST_LAST_TRANSIT_ROUTES_SEARCH_ENDPOINT = "/api/transit/routes/first-last/search";
const TRANSIT_ROUTE_CACHE_TTL_MS = 5 * 60 * 1000;

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
    stations: Array.isArray(segment?.stations)
      ? segment.stations.map(normalizeStation)
      : [],
    scheduledWaitMinutes: segment?.scheduledWaitMinutes,
    realTimeArrivalSeconds: segment?.realTimeArrivalSeconds,
    realTimeSource: segment?.realTimeSource,
    raw: segment,
  };
}

export function normalizeTransitRoute(route) {
  const segments = Array.isArray(route?.segments)
    ? route.segments.map(normalizeSegment)
    : [];

  return {
    routeId: route?.routeId,
    provider: route?.provider,
    originAddress: route?.originAddress ?? "",
    destinationAddress: route?.destinationAddress ?? "",
    totalDurationMinutes: route?.totalDurationMinutes ?? 0,
    realTimeDurationMinutes: route?.realTimeDurationMinutes,
    totalCost: route?.totalCost,
    transferCount: route?.transferCount ?? 0,
    segments,
    raw: route,
  };
}

export async function searchTransitRoutes({
  originX,
  originY,
  originAddress,
  destX,
  destY,
  destAddress,
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
  };
  const queryString = toQueryString(queryParams);
  const requestPath = `${TRANSIT_ROUTES_SEARCH_ENDPOINT}${queryString}`;

  if (!forceRefresh) {
    const cachedSearches = await readHomeCacheAsync(
      homeCacheKeys.transitRouteSearch,
      null,
    );
    const cached = cachedSearches?.searches?.[requestPath];

    if (
      cached &&
      Date.now() - cached.savedAt < TRANSIT_ROUTE_CACHE_TTL_MS &&
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
  const routes = Array.isArray(response?.data) ? response.data : response;

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
    savedAt: Date.now(),
    routes: normalizedRoutes,
  };

  const recentSearches = Object.entries(searches)
    .filter(([, entry]) => Date.now() - entry.savedAt < TRANSIT_ROUTE_CACHE_TTL_MS)
    .sort(([, first], [, second]) => second.savedAt - first.savedAt)
    .slice(0, 8);

  await writeHomeCacheAsync(homeCacheKeys.transitRouteSearch, {
    searches: Object.fromEntries(recentSearches),
  });

  return normalizedRoutes;
}


export async function searchFirstLastTransitRoutes({
  originX,
  originY,
  originAddress,
  destX,
  destY,
  destAddress,
  scheduleType,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  const requestPath =
    `${FIRST_LAST_TRANSIT_ROUTES_SEARCH_ENDPOINT}${toQueryString({
      originX,
      originY,
      originAddress,
      destX,
      destY,
      destAddress,
      scheduleType,
    })}`;

  const response = await requestTransitRouteJson({
    path: requestPath,
    method: "GET",
    accessToken,
    signal,
    errorMessage: "첫차·막차 최적 경로 검색에 실패했습니다.",
  });
  const options = Array.isArray(response?.data) ? response.data : response;

  if (!Array.isArray(options)) {
    return [];
  }

  return options.map((option) => {
    const rawRoute = option?.route ?? option;
    return {
      ...normalizeTransitRoute(rawRoute),
      raw: rawRoute,
      estimatedDepartureAt: option?.estimatedDepartureAt,
      scheduleType: option?.scheduleType ?? scheduleType,
    };
  });
}
