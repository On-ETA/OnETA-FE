import { createCurrentLocationRequest } from "../utils/currentLocationRequest";
import { preloadNaverMap } from "./NaverMapView";

async function fetchCurrentCoordinate() {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("현재 위치 기능을 사용할 수 없습니다.");
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = Number(position?.coords?.latitude);
        const longitude = Number(position?.coords?.longitude);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          reject(new Error("현재 위치 좌표가 올바르지 않습니다."));
          return;
        }

        resolve({
          latitude,
          longitude,
        });
      },
      (error) => {
        const nextError = new Error(
          error?.message || "현재 위치를 가져오지 못했습니다.",
        );

        nextError.code = error?.code;
        reject(nextError);
      },
      {
        enableHighAccuracy: false,
        maximumAge: 60 * 1000,
        timeout: 10000,
      },
    );
  });
}

const currentLocation = createCurrentLocationRequest(fetchCurrentCoordinate);
export const getCurrentCoordinate = currentLocation.getCoordinate;
export const getCachedCurrentCoordinate = currentLocation.getCachedCoordinate;

function waitForNaverReverseGeocoder(timeoutMs = 5000) {
  const maps = globalThis.naver?.maps;
  if (!maps) return Promise.resolve(null);
  if (typeof maps.Service?.reverseGeocode === "function") return Promise.resolve(maps);
  if (maps.jsContentLoaded === true) return Promise.resolve(maps);

  return new Promise((resolve) => {
    let settled = false;
    let pollTimer = null;
    const prevOnLoaded = maps.onJSContentLoaded;
    const onLoaded = (...args) => {
      if (typeof prevOnLoaded === "function") {
        try {
          prevOnLoaded(...args);
        } catch {
          // Ignore unrelated callback errors.
        }
      }
      finish();
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      clearTimeout(pollTimer);
      if (maps.onJSContentLoaded === onLoaded) {
        maps.onJSContentLoaded = prevOnLoaded;
      }
      resolve(globalThis.naver?.maps ?? null);
    };
    const timeoutTimer = setTimeout(finish, timeoutMs);
    maps.onJSContentLoaded = onLoaded;
    const poll = () => {
      const current = globalThis.naver?.maps;
      if (
        typeof current?.Service?.reverseGeocode === "function" ||
        current?.jsContentLoaded === true
      ) {
        finish();
        return;
      }
      pollTimer = setTimeout(poll, 50);
    };
    pollTimer = setTimeout(poll, 50);
  });
}

function formatNaverResultAddress(result) {
  if (!result) return "";
  const region = result.region ?? {};
  const land = result.land ?? {};
  const landName = String(land.name ?? "").trim();
  const number1 = String(land.number1 ?? "").trim();
  const number2 = String(land.number2 ?? "").trim();
  const landNumber = number1 ? (number2 ? `${number1}-${number2}` : number1) : "";
  if (!landName && !landNumber) return "";

  if (result.name === "roadaddr") {
    const roadAreas = [region.area1?.name, region.area2?.name]
      .map((part) => String(part ?? "").trim())
      .filter(Boolean);
    const area3 = String(region.area3?.name ?? "").trim();
    if (area3 && /[읍면]$/.test(area3)) {
      roadAreas.push(area3);
    }
    return [...roadAreas, landName, landNumber].filter(Boolean).join(" ").trim();
  }

  const areaParts = [
    region.area1?.name,
    region.area2?.name,
    region.area3?.name,
    region.area4?.name,
  ]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean);
  return [...areaParts, landName, landNumber].filter(Boolean).join(" ").trim();
}

export async function reverseGeocode({ latitude, longitude } = {}) {
  const resolvedLatitude = latitude === null || latitude === undefined || latitude === "" ? NaN : Number(latitude);
  const resolvedLongitude = longitude === null || longitude === undefined || longitude === "" ? NaN : Number(longitude);
  if (!Number.isFinite(resolvedLatitude) || !Number.isFinite(resolvedLongitude)) throw new Error("위치 좌표가 올바르지 않습니다.");
  await preloadNaverMap();
  const maps = await waitForNaverReverseGeocoder();
  if (!maps?.Service?.reverseGeocode) throw new Error("지도 주소 변환 기능을 불러오지 못했습니다.");
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(result);
    };
    const timer = setTimeout(() => finish(new Error("선택한 위치의 주소 조회 시간이 초과되었습니다.")), 10000);
    try {
      maps.Service.reverseGeocode({
        coords: new maps.LatLng(resolvedLatitude, resolvedLongitude),
        orders: [maps.Service.OrderType?.ROAD_ADDR ?? "roadaddr", maps.Service.OrderType?.ADDR ?? "addr"].join(","),
      }, (status, response) => {
        if (status !== maps.Service.Status.OK) return finish(new Error("선택한 위치의 주소를 찾지 못했습니다."));
        const address = response?.v2?.address;
        const results = Array.isArray(response?.v2?.results) ? response.v2.results : [];
        const roadFromResults = formatNaverResultAddress(results.find((item) => item?.name === "roadaddr"));
        const parcelFromResults = formatNaverResultAddress(results.find((item) => item?.name === "addr"));
        const roadAddress =
          String(address?.roadAddress ?? "").trim() ||
          roadFromResults ||
          String(address?.jibunAddress ?? "").trim() ||
          parcelFromResults;
        if (!roadAddress) return finish(new Error("선택한 위치의 주소 정보가 없습니다."));
        finish(null, {
          address: roadAddress,
          roadAddress,
          name: roadAddress,
          latitude: resolvedLatitude,
          longitude: resolvedLongitude,
          raw: response,
        });
      });
    } catch (error) {
      finish(error);
    }
  });
}
