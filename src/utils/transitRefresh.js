export const TRANSIT_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function startTransitRefresh({ refresh, appState, onError = () => {} }) {
  let active = !appState.currentState || appState.currentState === "active";
  let disposed = false;
  let timer;
  let controller;
  let pending = false;
  let queuedRefresh = false;

  const request = async (forceRefresh) => {
    if (disposed || !active) return;
    if (pending) {
      queuedRefresh ||= forceRefresh;
      return;
    }
    queuedRefresh = false;
    pending = true;
    controller = new AbortController();
    try {
      await refresh({ forceRefresh, signal: controller.signal });
    } catch (error) {
      if (error?.name !== "AbortError" && !disposed) onError(error);
    } finally {
      pending = false;
      if (queuedRefresh && active && !disposed) {
        queuedRefresh = false;
        request(true);
      }
    }
  };
  const startTimer = () => {
    clearInterval(timer);
    timer = setInterval(() => request(true), TRANSIT_REFRESH_INTERVAL_MS);
  };
  const subscription = appState.addEventListener("change", state => {
    const wasActive = active;
    active = state === "active";
    if (!active) {
      clearInterval(timer);
      controller?.abort();
    } else if (!wasActive) {
      request(true);
      startTimer();
    }
  });
  if (active) {
    request(false);
    startTimer();
  }
  return () => {
    disposed = true;
    clearInterval(timer);
    controller?.abort();
    subscription.remove();
  };
}
