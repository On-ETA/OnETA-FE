import { getAccessToken } from "../auth/tokens";
import { requestJson } from "../client";

const TEST_FCM_ENDPOINT = "/api/test/fcm";

export async function sendTestFcm({
  payload,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  return requestJson({
    path: TEST_FCM_ENDPOINT,
    method: "POST",
    body: payload,
    accessToken,
    signal,
    errorMessage: "테스트 FCM 발송에 실패했습니다.",
  });
}
