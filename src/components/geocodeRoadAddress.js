import * as Location from "expo-location";
import { Platform } from "react-native";
import { ensureForegroundLocationPermission } from "./reverseGeocode";
import { parseRoadAddress, roadAddressResult, throwIfGeocodingAborted } from "../utils/roadAddress";

export async function geocodeRoadAddress({ keyword, signal } = {}) {
  throwIfGeocodingAborted(signal);
  const parsed = parseRoadAddress(keyword);
  if (!parsed) return [];
  if (Platform.OS === "android") await ensureForegroundLocationPermission();
  throwIfGeocodingAborted(signal);
  const coordinates = await Location.geocodeAsync(parsed.address);
  throwIfGeocodingAborted(signal);
  const results = [];
  for (const coordinate of coordinates) {
    const result = roadAddressResult({ roadAddress: parsed.address, x: coordinate.longitude, y: coordinate.latitude });
    if (!result) continue;
    const addresses = await Location.reverseGeocodeAsync(coordinate);
    throwIfGeocodingAborted(signal);
    // Do not offer a nearby place or parcel address as the requested road address.
    if (addresses.some(address => address.street?.replace(/\s+/g, "") === parsed.street &&
      String(address.streetNumber ?? "") === parsed.buildingNumber)) results.push(result);
  }
  return results;
}
