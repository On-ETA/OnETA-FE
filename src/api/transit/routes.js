import { getAccessToken } from "../auth/tokens";
import { reissueAuthTokens } from "../auth/reissue";
import { requestJson } from "../client";

const TRANSIT_ROUTES_SEARCH_ENDPOINT = "/api/transit/routes/search";

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

function normalizeSegment(segment, index) {
  return {
    id: `${segment?.transitType ?? "segment"}-${index}`,
    transitType: segment?.transitType ?? "",
    startStation: segment?.startStation ?? "",
    endStation: segment?.endStation ?? "",
    durationMinutes: segment?.durationMinutes ?? 0,
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
  signal,
} = {}) {
  const response = await requestTransitRouteJson({
    path: `${TRANSIT_ROUTES_SEARCH_ENDPOINT}${toQueryString({
      originX,
      originY,
      originAddress,
      destX,
      destY,
      destAddress,
      ...params,
    })}`,
    method: "GET",
    accessToken,
    signal,
    errorMessage: "대중교통 경로 검색에 실패했습니다.",
  });
  const routes = Array.isArray(response?.data) ? response.data : response;

  return Array.isArray(routes) ? routes.map(normalizeTransitRoute) : [];
}
