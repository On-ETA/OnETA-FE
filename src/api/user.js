/*
  회원 정보 조회, GET /api/user
  회원 탈퇴, DELETE /api/user

  성공 응답:
  {
    "code": "SUCCESS",
    "message": "요청이 성공적으로 처리되었습니다."
  }

  실패 응답:
  401 - 로그인하지 않은 사용자
  {
    "code": "C007",
    "message": "인증이 필요합니다."
  }
*/
import { reissueAuthTokens } from "./auth/reissue";
import { clearAuthTokens, getAccessToken } from "./auth/tokens";
import { requestJson } from "./client";
import { clearHomeCacheAsync } from "./homeCache";
import { cancelHomePreload } from "./homePreload";

const USER_ENDPOINT = "/api/user";

function isAuthError(error) {
  if (error?.code === "AUTH_REQUIRED") {
    return false;
  }

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

async function requestUserJson(options) {
  const fallbackMessage = options.errorMessage ?? "회원 요청에 실패했습니다.";

  try {
    const response = await requestJson(options);
    const businessError = createBusinessError(response, fallbackMessage);

    if (businessError) {
      throw businessError;
    }

    return response;
  } catch (error) {
    if (!isAuthError(error)) {
      throw error;
    }

    let nextAccessToken;

    try {
      const { accessToken } = await reissueAuthTokens({
        signal: options.signal,
      });
      nextAccessToken = accessToken;
    } catch (reissueError) {
      if (reissueError?.name === "AbortError") {
        throw reissueError;
      }
      throw error;
    }

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

export async function deleteUser({ accessToken = getAccessToken(), signal } = {}) {
  await cancelHomePreload();

  const data = await requestUserJson({
    path: USER_ENDPOINT,
    method: "DELETE",
    accessToken,
    signal,
    errorMessage: "회원 탈퇴에 실패했습니다.",
  });

  await clearAuthTokens();
  await clearHomeCacheAsync();

  return data;
}
