const DEFAULT_API_BASE_URL = "http://on-eta.com";
const DEFAULT_TIMEOUT_MS = 10000;
const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

export const API_BASE_URL =
  configuredApiBaseUrl || DEFAULT_API_BASE_URL;

export function buildApiUrl(path = "") {
  if (!path) {
    return API_BASE_URL;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL.replace(/\/$/, "")}${normalizedPath}`;
}

export async function parseJsonSafely(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function createApiError(response, data, fallbackMessage) {
  const message =
    data?.message ??
    (response.status >= 500
      ? "서버 에러가 발생했습니다. 잠시 후 다시 시도해 주세요."
      : fallbackMessage);
  const error = new Error(message);

  error.status = response.status;
  error.code = data?.code;
  error.data = data;

  return error;
}

function createNetworkError(error, requestUrl) {
  const networkError = new Error(
    "요청에 실패했습니다. 잠시 후 다시 시도해 주세요.",
  );

  // 로컬 개발 중 실제 요청 URL을 확인할 수 있게 남겨둡니다.
  networkError.url = requestUrl;
  networkError.cause = error;

  return networkError;
}

function createRequestSignal({ signal, timeoutMs }) {
  if (!signal && !timeoutMs) {
    return {};
  }

  const controller = new AbortController();
  const timeoutId = timeoutMs
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  if (signal) {
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  return {
    signal: controller.signal,
    clear: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    },
  };
}

export async function requestJson({
  path,
  method = "GET",
  body,
  accessToken,
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  timeoutMessage = "요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.",
  errorMessage = "API request failed",
}) {
  const requestUrl = buildApiUrl(path);
  const headers = {
    Accept: "application/json",
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const requestSignal = createRequestSignal({ signal, timeoutMs });
  let response;

  try {
    response = await fetch(requestUrl, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: requestSignal.signal ?? signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(timeoutMessage);
    }

    throw createNetworkError(error, requestUrl);
  } finally {
    requestSignal.clear?.();
  }

  const data = await parseJsonSafely(response);

  if (!response.ok) {
    throw createApiError(response, data, errorMessage);
  }

  return data;
}
