import { createCurrentLocationRequest } from "../utils/currentLocationRequest";

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

export async function reverseGeocode() {
  throw new Error("웹에서는 위치 주소 변환 기능을 사용할 수 없습니다.");
}
