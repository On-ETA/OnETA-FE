import { useEffect, useRef, useState } from "react";
import { searchAddresses } from "../api/address/search";
import { createThrottledTask } from "../utils/throttledTask";
import { isSearchKeywordReady } from "../utils/searchKeyword";

export function useAddressSearch({ keyword, enabled = true, fallbackToRoadAddress = false }) {
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const scheduler = useRef(null);
  if (!scheduler.current) scheduler.current = createThrottledTask(1000);
  const trimmedKeyword = keyword.trim();
  useEffect(() => () => scheduler.current.cancel(), []);

  useEffect(() => {
    setResults([]);
    setError("");
    if (!enabled || !trimmedKeyword) {
      scheduler.current.cancel();
      setIsSearching(false);
      return undefined;
    }
    const controller = new AbortController();
    setIsSearching(true);
    scheduler.current.schedule(async () => {
      if (controller.signal.aborted) return;
      try {
        const found = await searchAddresses({ keyword: trimmedKeyword, fallbackToRoadAddress, signal: controller.signal });
        if (!controller.signal.aborted) setResults(found);
      } catch (failure) {
        if (!controller.signal.aborted && failure?.name !== "AbortError") {
          setError(failure?.message ?? "주소 검색에 실패했습니다.");
        }
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, () => isSearchKeywordReady(trimmedKeyword));
    return () => controller.abort();
  }, [enabled, trimmedKeyword, fallbackToRoadAddress]);

  return { results, isSearching, error };
}
