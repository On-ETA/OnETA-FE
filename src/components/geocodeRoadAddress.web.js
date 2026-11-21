import { preloadNaverMap } from "./NaverMapView";
import { parseRoadAddress, roadAddressResult, throwIfGeocodingAborted } from "../utils/roadAddress";

function waitForNaverGeocoder({ signal, timeoutMs = 5000 } = {}) {
  const maps = globalThis.naver?.maps;
  if (!maps) return Promise.resolve(null);
  if (typeof maps.Service?.geocode === "function") return Promise.resolve(maps.Service);
  if (maps.jsContentLoaded === true) return Promise.resolve(maps.Service ?? null);

  return new Promise((resolve, reject) => {
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
      finish(null, globalThis.naver?.maps?.Service ?? null);
    };
    const finish = (error, service) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      clearTimeout(pollTimer);
      signal?.removeEventListener("abort", abort);
      if (maps.onJSContentLoaded === onLoaded) {
        maps.onJSContentLoaded = prevOnLoaded;
      }
      if (error) reject(error);
      else resolve(service);
    };
    const abort = () => {
      const error = new Error("주소 조회가 취소되었습니다.");
      error.name = "AbortError";
      finish(error);
    };
    const timeoutTimer = setTimeout(() => finish(null, globalThis.naver?.maps?.Service ?? null), timeoutMs);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }
    maps.onJSContentLoaded = onLoaded;
    const poll = () => {
      const current = globalThis.naver?.maps;
      if (
        typeof current?.Service?.geocode === "function" ||
        current?.jsContentLoaded === true
      ) {
        finish(null, current?.Service ?? null);
        return;
      }
      pollTimer = setTimeout(poll, 50);
    };
    pollTimer = setTimeout(poll, 50);
  });
}

export async function geocodeRoadAddress({ keyword, signal } = {}) {
  throwIfGeocodingAborted(signal);
  if (!parseRoadAddress(keyword)) return [];
  await preloadNaverMap();
  throwIfGeocodingAborted(signal);
  const service = await waitForNaverGeocoder({ signal });
  throwIfGeocodingAborted(signal);
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
