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

export async function reverseGeocode({ latitude, longitude }) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error("위치 좌표가 올바르지 않습니다.");
  await preloadNaverMap();
  const maps = globalThis.naver?.maps;
  if (!maps?.Service?.reverseGeocode) throw new Error("지도 주소 변환 기능을 불러오지 못했습니다.");
  return new Promise((resolve, reject) => {
    maps.Service.reverseGeocode({
      coords: new maps.LatLng(latitude, longitude),
      orders: [maps.Service.OrderType?.ROAD_ADDR ?? "roadaddr", maps.Service.OrderType?.ADDR ?? "addr"].join(","),
    }, (status, response) => {
      if (status !== maps.Service.Status.OK) return reject(new Error("선택한 위치의 주소를 찾지 못했습니다."));
      const address = response?.v2?.address;
      const roadAddress = address?.roadAddress || address?.jibunAddress;
      if (!roadAddress) return reject(new Error("선택한 위치의 주소 정보가 없습니다."));
      resolve({ address: roadAddress, roadAddress, name: roadAddress, latitude, longitude, raw: response });
    });
  });
}
