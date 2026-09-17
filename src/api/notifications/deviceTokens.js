import { getAccessToken, getAuthSessionId } from "../auth/tokens";
import { reissueAuthTokens } from "../auth/reissue";
import { requestJson } from "../client";

const DEVICE_TOKENS_ENDPOINT = "/api/notifications/device-tokens";

function isAuthError(error) {
  return (
    error?.status === 401 ||
    error?.status === 403 ||
    error?.code === "C007" ||
    error?.code === "C005"
  );
}

function createBusinessError(response, fallbackMessage) {
  if (!response?.code || response.code === "SUCCESS") {
    return null;
  }

  const error = new Error(response.message ?? fallbackMessage);

  error.code = response.code;
  error.data = response;

  return error;
}

async function requestDeviceTokenJson(options) {
  const sessionId = getAuthSessionId();
  const fallbackMessage =
    options.errorMessage ?? "디바이스 토큰 등록에 실패했습니다.";

  try {
    const response = await requestJson(options);
    const businessError = createBusinessError(response, fallbackMessage);

    if (businessError) {
      throw businessError;
    }

    return response;
  } catch (error) {
    if (!isAuthError(error) || options.signal?.aborted || sessionId !== getAuthSessionId()) {
      throw error;
    }

    let nextAccessToken;

    try {
      const { accessToken } = await reissueAuthTokens({
        signal: options.signal,
      });
      nextAccessToken = accessToken;
    } catch {
      throw error;
    }

    if (options.signal?.aborted || sessionId !== getAuthSessionId()) throw error;

    const response = await requestJson({
      ...options,
      accessToken: nextAccessToken,
    });
    const businessError = createBusinessError(response, fallbackMessage);

    if (businessError) {
      throw businessError;
    }

    return response;
  }
}

/**
 * @param {object} [options]
 * @param {string} [options.token]
 * @param {string} [options.deviceToken]
 * @param {string} [options.platform]
 * @param {Record<string, unknown>} [options.payload]
 * @param {string | null} [options.accessToken]
 * @param {AbortSignal} [options.signal]
 */
export async function registerDeviceToken({
  token,
  deviceToken = token,
  platform,
  payload,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  if (!deviceToken) {
    throw new Error("디바이스 토큰이 필요합니다.");
  }

  return requestDeviceTokenJson({
    path: DEVICE_TOKENS_ENDPOINT,
    method: "POST",
    body: payload ?? { deviceToken },
    accessToken,
    signal,
    errorMessage: "디바이스 토큰 등록에 실패했습니다.",
  });
}
