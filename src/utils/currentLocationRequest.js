// Share an in-flight lookup and briefly reuse its result across map screens.
export function createCurrentLocationRequest(lookup, now = Date.now, { timeoutMs = 15000 } = {}) {
  let pending = null;
  let coordinate = null;
  let resolvedAt = 0;

  const getCachedCoordinate = () =>
    coordinate && now() - resolvedAt < 60 * 1000 ? coordinate : null;

  const getCoordinate = () => {
    const cached = getCachedCoordinate();
    if (cached) return Promise.resolve(cached);
    if (pending) return pending;

    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error("위치 조회 시간이 초과되었습니다.");
        error.code = "LOCATION_TIMEOUT";
        reject(error);
      }, timeoutMs);
    });
    pending = Promise.race([Promise.resolve().then(lookup), timeout]).then(result => {
      coordinate = result;
      resolvedAt = now();
      return result;
    }).finally(() => {
      clearTimeout(timer);
      pending = null;
    });
    return pending;
  };

  return { getCoordinate, getCachedCoordinate };
}
