import { getAccessToken } from "../auth/tokens";
import { requestJson } from "../client";

const TEST_SYNC_BUS_ENDPOINT = "/api/test/sync-bus";

export async function syncBus({ accessToken = getAccessToken(), signal } = {}) {
  return requestJson({
    path: TEST_SYNC_BUS_ENDPOINT,
    method: "GET",
    accessToken,
    signal,
    errorMessage: "버스 동기화 테스트에 실패했습니다.",
  });
}
