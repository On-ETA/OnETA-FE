import * as Location from "expo-location";
import { Platform } from "react-native";

import { NAVER_MAP_CLIENT_ID } from "../config/naverMap";
import { createCurrentLocationRequest } from "../utils/currentLocationRequest";
import { parseRoadAddress } from "../utils/roadAddress";

let permissionPromise = null;
let naverGeocoderScriptPromise = null;

function loadNaverGeocoderScript() {
  if (typeof document === "undefined") {
    return Promise.reject(
      new Error("웹 지도 환경을 찾을 수 없습니다."),
    );
  }

  if (globalThis.naver?.maps?.Service) {
    return Promise.resolve(globalThis.naver.maps);
  }

  if (!naverGeocoderScriptPromise) {
    naverGeocoderScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");

      script.async = true;
      script.src =
        "https://oapi.map.naver.com/openapi/v3/maps.js" +
        `?ncpKeyId=${encodeURIComponent(NAVER_MAP_CLIENT_ID)}` +
        "&submodules=geocoder";

      script.onload = () => {
        if (globalThis.naver?.maps?.Service) {
          resolve(globalThis.naver.maps);
          return;
        }

        reject(
          new Error("네이버 지도 주소 변환 모듈을 초기화하지 못했습니다."),
        );
      };

      script.onerror = () => {
        reject(
          new Error("네이버 지도 주소 변환 모듈을 불러오지 못했습니다."),
        );
      };

      document.head.appendChild(script);
    }).catch((error) => {
      naverGeocoderScriptPromise = null;

      throw error;
    });
  }

  return naverGeocoderScriptPromise;
}

export async function ensureForegroundLocationPermission() {
  if (Platform.OS === "web") {
    throw new Error(
      "",
    );
  }

  if (!permissionPromise) {
    permissionPromise = (async () => {
      let permission =
        await Location.getForegroundPermissionsAsync();

      if (permission.status !== "granted") {
        permission =
          await Location.requestForegroundPermissionsAsync();
      }

      if (permission.status !== "granted") {
        const error = new Error(
          "위치 기능을 사용하려면 위치 권한이 필요합니다.",
        );

        error.code = "LOCATION_PERMISSION_DENIED";

        throw error;
      }

      return true;
    })().finally(() => {
      permissionPromise = null;
    });
  }

  return permissionPromise;
}

function normalizeCoordinate({
  latitude,
  longitude,
} = {}) {
  const resolvedLatitude =
    Number(latitude);

  const resolvedLongitude =
    Number(longitude);

  if (
    !Number.isFinite(
      resolvedLatitude,
    ) ||
    !Number.isFinite(
      resolvedLongitude,
    )
  ) {
    throw new Error(
      "올바르지 않은 위치 좌표입니다.",
    );
  }

  return {
    latitude: resolvedLatitude,
    longitude: resolvedLongitude,
  };
}

function cleanAddress(value) {
  if (!value) {
    return "";
  }

  return String(value)
    .replace(/^대한민국(?:[\s,]+|$)/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function removeDuplicateParts(values) {
  const result = [];

  values
    .filter(Boolean)
    .map((value) =>
      String(value).trim(),
    )
    .filter(Boolean)
    .forEach((value) => {
      if (!result.includes(value)) {
        result.push(value);
      }
    });

  return result;
}

function buildRoadAddress(result) {
  const formattedAddress = cleanAddress(result.formattedAddress);
  if (parseRoadAddress(formattedAddress)) return formattedAddress;

  const areas = [result.region, result.city, result.district, result.subregion];
  const name = cleanAddress(result.name);
  if (parseRoadAddress(name)) {
    const includesArea = areas.some((area) => area && name.startsWith(`${area} `));
    return includesArea ? name : cleanAddress(removeDuplicateParts([...areas, name]).join(" "));
  }

  const street = cleanAddress(result.street);
  const streetNumber = cleanAddress(result.streetNumber);
  const numberFromName = /^\d+(?:-\d+)?(?:번지)?$/.test(name) ? name : "";
  if (street) {
    return cleanAddress(removeDuplicateParts([...areas, street, streetNumber || numberFromName]).join(" "));
  }

  // Administrative areas and place names alone do not identify a street address.
  if (/(?:^|[\s,])(?:산\s*)?\d+(?:-\d+)?(?:번지)?(?:\s*\([^)]*\))?$/.test(formattedAddress)) {
    return formattedAddress;
  }
  if (streetNumber || numberFromName) {
    return cleanAddress(removeDuplicateParts([...areas, streetNumber || numberFromName]).join(" "));
  }

  return "";
}

function getGeocodedPlaceName(result) {
  const name = cleanAddress(result.name);
  const administrativeNames = [result.region, result.city, result.district, result.subregion, result.country];
  if (!/\p{L}/u.test(name) || administrativeNames.some((area) => cleanAddress(area) === name)) {
    return "";
  }
  return name;
}

function buildNaverRoadAddress(address) {
  return cleanAddress(
    address?.roadAddress ||
      address?.jibunAddress ||
      "",
  );
}

async function reverseGeocodeOnWeb(coordinate) {
  const maps = await loadNaverGeocoderScript();

  return new Promise((resolve, reject) => {
    maps.Service.reverseGeocode(
      {
        coords: new maps.LatLng(
          coordinate.latitude,
          coordinate.longitude,
        ),
        orders: [
          maps.Service.OrderType?.ROAD_ADDR ?? "roadaddr",
          maps.Service.OrderType?.ADDR ?? "addr",
        ].join(","),
      },
      (status, response) => {
        if (
          status !== maps.Service.Status.OK
        ) {
          reject(
            new Error("선택한 위치의 주소를 찾지 못했습니다."),
          );

          return;
        }

        const address =
          response?.v2?.address ?? null;
        const roadAddress =
          buildNaverRoadAddress(
            address,
          );

        if (!roadAddress) {
          reject(
            new Error("선택한 위치의 주소 정보가 없습니다."),
          );

          return;
        }

        resolve({
          address: roadAddress,
          roadAddress,
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          name: address?.roadAddress || address?.jibunAddress || "",
          raw: response,
        });
      },
    );
  });
}

async function fetchCurrentCoordinate() {
  await ensureForegroundLocationPermission();

  // The device's cached position is optional; a cache/bridge failure must not
  // prevent the fresh-position lookup below.
  let lastKnownPosition = null;
  try {
    lastKnownPosition = await Location.getLastKnownPositionAsync({
      maxAge: 60 * 1000,
      requiredAccuracy: 200,
    });
  } catch {
    // Continue with a fresh location instead of repeatedly retrying this cache.
  }

  if (lastKnownPosition?.coords) {
    return normalizeCoordinate({
      latitude:
        lastKnownPosition.coords.latitude,
      longitude:
        lastKnownPosition.coords.longitude,
    });
  }

  const position =
    await Location.getCurrentPositionAsync({
      accuracy:
        Location.Accuracy.Balanced,
    });

  return normalizeCoordinate({
    latitude: position?.coords?.latitude,
    longitude: position?.coords?.longitude,
  });
}

const currentLocation = createCurrentLocationRequest(fetchCurrentCoordinate);
export const getCurrentCoordinate = currentLocation.getCoordinate;
export const getCachedCurrentCoordinate = currentLocation.getCachedCoordinate;

export async function reverseGeocode({
  latitude,
  longitude,
} = {}) {
  const coordinate =
    normalizeCoordinate({
      latitude,
      longitude,
    });

  if (Platform.OS === "web") {
    return reverseGeocodeOnWeb(
      coordinate,
    );
  }

  await ensureForegroundLocationPermission();

  const results =
    await Location.reverseGeocodeAsync(
      coordinate,
    );

  const result = results?.[0];

  if (!result) {
    throw new Error(
      "선택한 위치의 주소를 찾지 못했습니다.",
    );
  }

  const roadAddress =
    buildRoadAddress(result);
  if (!roadAddress) {
    throw new Error(
      "선택한 위치의 주소 정보가 없습니다.",
    );
  }

  return {
    address: roadAddress,
    roadAddress,
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    name: getGeocodedPlaceName(result) || roadAddress,
    raw: result,
  };
}
