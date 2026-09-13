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

const USER_ENDPOINT = "/api/user";

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

    try {
      const { accessToken } = await reissueAuthTokens({
        signal: options.signal,
      });
      const response = await requestJson({
        ...options,
        accessToken,
      });
      const businessError = createBusinessError(response, fallbackMessage);

      if (businessError) {
        throw businessError;
      }

      return response;
    } catch {
      throw error;
    }
  }
}

export function normalizeUser(user) {
  const userData = user?.data ?? user;

  return {
    email: userData?.email,
    nickname: userData?.nickname,
    raw: userData,
  };
}

export async function getUser({ accessToken = getAccessToken(), signal } = {}) {
  const response = await requestUserJson({
    path: USER_ENDPOINT,
    method: "GET",
    accessToken,
    signal,
    errorMessage: "회원 정보를 불러오지 못했습니다.",
  });

  return normalizeUser(response);
}

export async function deleteUser({ accessToken = getAccessToken(), signal } = {}) {
  const data = await requestUserJson({
    path: USER_ENDPOINT,
    method: "DELETE",
    accessToken,
    signal,
    errorMessage: "회원 탈퇴에 실패했습니다.",
  });

  clearAuthTokens();

  return data;
}
