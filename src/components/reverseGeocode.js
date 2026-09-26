import * as Location from "expo-location";
import { Platform } from "react-native";

let permissionGranted = false;

async function ensureLocationPermission() {
  /*
   * Android reverseGeocodeAsync는
   * foreground location 권한이 필요함.
   */
  if (Platform.OS !== "android") {
    return;
  }

  if (permissionGranted) {
    return;
  }

  const currentPermission =
    await Location.getForegroundPermissionsAsync();

  if (currentPermission.status === "granted") {
    permissionGranted = true;
    return;
  }

  const requestedPermission =
    await Location.requestForegroundPermissionsAsync();

  if (requestedPermission.status !== "granted") {
    throw new Error(
      "주소 확인을 위해 위치 권한이 필요합니다.",
    );
  }

  permissionGranted = true;
}

function cleanAddress(address) {
  if (!address) {
    return "";
  }

  return String(address)
    .replace(/^대한민국\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildAddressFromParts(result) {
  if (!result) {
    return "";
  }

  /*
   * Android에서는 formattedAddress가 제공될 수 있으므로
   * 이것을 가장 먼저 사용.
   */
  const formattedAddress = cleanAddress(
    result.formattedAddress,
  );

  if (formattedAddress) {
    return formattedAddress;
  }

  /*
   * formattedAddress가 없을 경우
   * 각각의 주소 요소를 조합.
   */
  const parts = [
    result.region,
    result.city,
    result.district,
    result.street,
    result.streetNumber,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(
      (value, index, array) =>
        array.indexOf(value) === index,
    );

  return cleanAddress(parts.join(" "));
}

export async function reverseGeocode({
  latitude,
  longitude,
} = {}) {
  const resolvedLatitude = Number(latitude);
  const resolvedLongitude = Number(longitude);

  if (
    !Number.isFinite(resolvedLatitude) ||
    !Number.isFinite(resolvedLongitude)
  ) {
    throw new Error(
      "올바르지 않은 지도 좌표입니다.",
    );
  }

  /*
   * 현재 프로젝트는 Android 앱 사용을 기준으로 함.
   */
  if (Platform.OS === "web") {
    throw new Error(
      "현재 Reverse Geocoding은 앱 환경에서 사용하도록 구성되어 있습니다.",
    );
  }

  await ensureLocationPermission();

  const results =
    await Location.reverseGeocodeAsync({
      latitude: resolvedLatitude,
      longitude: resolvedLongitude,
    });

  const result = results?.[0];

  if (!result) {
    throw new Error(
      "선택한 위치의 주소를 찾지 못했습니다.",
    );
  }

  const address = buildAddressFromParts(result);

  if (!address) {
    throw new Error(
      "선택한 위치의 주소 정보가 없습니다.",
    );
  }

  return {
    address,

    /*
     * Android Geocoder는 네이버처럼
     * roadAddress / jibunAddress를 명확하게
     * 구분해서 반환하지 않음.
     *
     * 서버 검색용 주소로 address를 사용.
     */
    roadAddress: address,

    latitude: resolvedLatitude,
    longitude: resolvedLongitude,

    raw: result,
  };
}