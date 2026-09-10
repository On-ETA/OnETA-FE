import { getAccessToken } from "../auth/tokens";
import { requestJson } from "../client";

const DEVICE_TOKENS_ENDPOINT = "/api/notifications/device-tokens";

export async function registerDeviceToken({
  token,
  deviceToken = token,
  platform,
  payload,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  return requestJson({
    path: DEVICE_TOKENS_ENDPOINT,
    method: "POST",
    body: payload ?? {
      deviceToken,
      platform,
    },
    accessToken,
    signal,
    errorMessage: "디바이스 토큰 등록에 실패했습니다.",
  });
}
