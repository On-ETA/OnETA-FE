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
import { notifyAuthRequired } from "./authEvents";
import {
  clearAuthTokens,
  extractAuthTokens,
  getAuthTokens,
  getAuthSessionId,
  setAuthTokens,
} from "./tokens";

const REISSUE_ENDPOINT = "/api/auth/reissue";
let pendingReissue = null;

async function performReissue(refreshToken, sessionId) {
  try {
    const response = await requestJson({
      path: REISSUE_ENDPOINT,
      method: "POST",
      body: {
        refreshToken,
      },
      errorMessage: "토큰 재발급에 실패했습니다.",
    });
    const nextTokens = extractAuthTokens(response);

    if (!nextTokens.accessToken) {
      throw new Error("토큰 재발급 응답에 Access Token이 없습니다.");
    }

    if (sessionId !== getAuthSessionId()) {
      const error = new Error("Authentication session changed");
      error.name = "AbortError";
      throw error;
    }

    const updatedTokens = {
      accessToken: nextTokens.accessToken,
      refreshToken: nextTokens.refreshToken ?? refreshToken,
    };
    await setAuthTokens(updatedTokens, { isRefresh: true });

    return {
      response,
      ...updatedTokens,
    };
  } catch (error) {
    const isAuthFailure =
      error?.status === 401 ||
      error?.status === 403 ||
      error?.code === "C005" ||
      error?.code === "C007";

    if (isAuthFailure && sessionId === getAuthSessionId()) {
      await clearAuthTokens().catch(() => null);
      notifyAuthRequired({ reason: "refresh_failed" });
    }

    throw error;
  }
}

function waitForReissue(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) {
    const error = new Error("Request aborted");
    error.name = "AbortError";
    return Promise.reject(error);
  }

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      const error = new Error("Request aborted");
      error.name = "AbortError";
      reject(error);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", onAbort);
    });
  });
}

function abortedRequest() {
  const error = new Error("Request aborted");
  error.name = "AbortError";
  return Promise.reject(error);
}

export function reissueAuthTokens({
  refreshToken = getAuthTokens().refreshToken,
  signal,
} = {}) {
  if (signal?.aborted) return abortedRequest();
  if (!refreshToken) {
    const error = new Error("Refresh Token이 없습니다.");
    error.code = "C005";
    notifyAuthRequired({ reason: "missing_refresh_token" });
    return Promise.reject(error);
  }

  const sessionId = getAuthSessionId();
  if (pendingReissue?.sessionId === sessionId && pendingReissue.refreshToken === refreshToken) {
    return waitForReissue(pendingReissue.promise, signal);
  }

  const promise = performReissue(refreshToken, sessionId);
  pendingReissue = { sessionId, refreshToken, promise };
  promise.then(
    () => { if (pendingReissue?.promise === promise) pendingReissue = null; },
    () => { if (pendingReissue?.promise === promise) pendingReissue = null; },
  );
  return waitForReissue(promise, signal);
}

export { reissueAuthTokens as reissueTokens };
