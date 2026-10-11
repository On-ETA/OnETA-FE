import { preloadNaverMap } from "./NaverMapView";
import { parseRoadAddress, roadAddressResult, throwIfGeocodingAborted } from "../utils/roadAddress";

export async function geocodeRoadAddress({ keyword, signal } = {}) {
  throwIfGeocodingAborted(signal);
  if (!parseRoadAddress(keyword)) return [];
  await preloadNaverMap();
  throwIfGeocodingAborted(signal);
  const service = globalThis.naver?.maps?.Service;
  if (!service?.geocode) throw new Error("주소 좌표 조회 기능을 불러오지 못했습니다.");
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, results) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (error) reject(error); else resolve(results);
    };
    const abort = () => {
      const error = new Error("주소 조회가 취소되었습니다.");
      error.name = "AbortError";
      finish(error);
    };
    const timer = setTimeout(() => finish(new Error("주소 좌표 조회 시간이 초과되었습니다.")), 10000);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    try {
      service.geocode({ query: keyword.trim() }, (status, response) => {
        if (status !== service.Status.OK) {
          finish(new Error("주소 좌표 조회에 실패했습니다."));
          return;
        }
        const results = (response?.v2?.addresses ?? []).map(roadAddressResult).filter(Boolean);
        finish(null, results);
      });
    } catch (error) { finish(error); }
  });
}
