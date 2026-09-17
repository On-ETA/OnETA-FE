/*
  토큰 재발급, POST
  /api/auth/reissue

  request:
  {
    "refreshToken": "string"
  }

  success:
  {
    "code": "SUCCESS",
    "message": "요청이 성공적으로 처리되었습니다.",
    "data": {
      "accessToken": "string",
      "refreshToken": "string"
    }
  }
*/
import { requestJson } from "../client";
import {
  clearAuthTokens,
  extractAuthTokens,
  getAuthTokens,
  getAuthSessionId,
  setAuthTokens,
} from "./tokens";

const REISSUE_ENDPOINT = "/api/auth/reissue";

export async function reissueAuthTokens({
  refreshToken = getAuthTokens().refreshToken,
  signal,
} = {}) {
  const sessionId = getAuthSessionId();
  if (!refreshToken) {
    const error = new Error("Refresh Token이 없습니다.");
    error.code = "C005";
    throw error;
  }

  try {
    const response = await requestJson({
      path: REISSUE_ENDPOINT,
      method: "POST",
      body: {
        refreshToken,
      },
      signal,
      errorMessage: "토큰 재발급에 실패했습니다.",
    });
    const nextTokens = extractAuthTokens(response);

    if (sessionId !== getAuthSessionId() || signal?.aborted) {
      const error = new Error("Authentication session changed");
      error.name = "AbortError";
      throw error;
    }

    setAuthTokens(nextTokens, { isRefresh: true });

    return {
      response,
      ...nextTokens,
    };
  } catch (error) {
    if (error?.status === 403 && sessionId === getAuthSessionId()) {
      clearAuthTokens();
    }

    throw error;
  }
}

export { reissueAuthTokens as reissueTokens };
