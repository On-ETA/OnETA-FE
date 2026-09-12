/*
  버스 노선 실시간 위치 조회 API

  GET /api/bus-routes/{routeId}/locations

  sectOrd: 정류장 순번

  성공 응답:
  {
    "code": "SUCCESS",
    "message": "요청이 성공적으로 처리되었습니다.",
    "data": {
      "activeBuses": [
        {
          "atStop": false,
          "depotDeparted": true,
          "plainNo": "서울71사1225",
          "sectOrd": 1
        }
      ],
      "depotDeparted": true,
      "depotDepartedBusNo": "서울71사1225",
      "routeId": "100100006",
      "turnaroundDeparted": true,
      "turnaroundDepartedBusNo": "서울71사1268"
    }
  }

  에러 응답:
  400 C002 노선 ID가 유효하지 않습니다.
  400 C002 해당 노선 정보를 찾을 수 없습니다.
  500 C001 실시간 버스 위치를 가져오는데 실패했습니다.
*/
import { getAccessToken } from "../../auth/tokens";
import { requestJson } from "../../client";

export const BUS_ROUTE_LOCATIONS_ENDPOINT = "/api/bus-routes";

function normalizeSectOrd(sectOrd) {
  const parsedSectOrd = Number(sectOrd);

  return Number.isFinite(parsedSectOrd) ? parsedSectOrd : null;
}

export function normalizeActiveBusLocation(bus) {
  return {
    plainNo: bus?.plainNo ?? "",
    sectOrd: normalizeSectOrd(bus?.sectOrd),
    atStop: Boolean(bus?.atStop),
    depotDeparted: Boolean(bus?.depotDeparted),
  };
}

export function normalizeBusRouteLocations(locationData) {
  const activeBuses = Array.isArray(locationData?.activeBuses)
    ? locationData.activeBuses.map(normalizeActiveBusLocation)
    : [];

  return {
    routeId: locationData?.routeId ?? "",
    activeBuses,
    depotDeparted: Boolean(locationData?.depotDeparted),
    depotDepartedBusNo: locationData?.depotDepartedBusNo ?? "",
    turnaroundDeparted: Boolean(locationData?.turnaroundDeparted),
    turnaroundDepartedBusNo: locationData?.turnaroundDepartedBusNo ?? "",
  };
}

export async function getBusRouteLocations({
  routeId,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  const normalizedRouteId = String(routeId ?? "").trim();

  if (!normalizedRouteId) {
    const error = new Error("노선 ID가 유효하지 않습니다.");

    error.status = 400;
    error.code = "C002";

    throw error;
  }

  const response = await requestJson({
    path: `${BUS_ROUTE_LOCATIONS_ENDPOINT}/${encodeURIComponent(
      normalizedRouteId,
    )}/locations`,
    method: "GET",
    accessToken,
    signal,
    errorMessage: "실시간 버스 위치를 가져오는데 실패했습니다.",
  });

  return {
    ...response,
    data: normalizeBusRouteLocations(response?.data),
  };
}
