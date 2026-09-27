import * as Location from "expo-location";
import { Platform } from "react-native";

let permissionPromise = null;

async function ensureForegroundLocationPermission() {
  if (Platform.OS === "web") {
    throw new Error(
      "현재 위치 기능은 웹 환경에서 사용할 수 없습니다.",
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
    })().catch((error) => {
      permissionPromise = null;

      throw error;
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
    .replace(/^대한민국\s*/, "")
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
  if (!result) {
    return "";
  }

  if (result.street) {
    const address = cleanAddress(
      removeDuplicateParts([
        result.region,
        result.city,
        result.district,
        result.subregion,
        result.street,
        result.streetNumber,
      ]).join(" "),
    );

    if (address) {
      return address;
    }
  }

  const formattedAddress = cleanAddress(
    result.formattedAddress,
  );

  if (formattedAddress) {
    return formattedAddress;
  }

  return cleanAddress(
    removeDuplicateParts([
      result.region,
      result.city,
      result.district,
      result.subregion,
      result.street,
      result.streetNumber,
      result.name,
    ]).join(" "),
  );
}

export async function getCurrentCoordinate() {
  await ensureForegroundLocationPermission();

  const lastKnownPosition =
    await Location.getLastKnownPositionAsync({
      maxAge: 60 * 1000,
      requiredAccuracy: 200,
    });

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

export async function reverseGeocode({
  latitude,
  longitude,
} = {}) {
  const coordinate =
    normalizeCoordinate({
      latitude,
      longitude,
    });

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
    name: result.name ?? "",
    raw: result,
  };
}
