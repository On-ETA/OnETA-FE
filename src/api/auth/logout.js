/*
  로그아웃, POST
  /api/auth/logout

  성공 응답:
  {
    "code": "SUCCESS",
    "message": "요청이 성공적으로 처리되었습니다."
  }
*/
import { requestJson } from "../client";
import { clearAuthTokens, getAccessToken } from "./tokens";

const LOGOUT_ENDPOINT = "/api/auth/logout";

function isAuthError(error) {
  return (
    error?.status === 401 ||
    error?.status === 403 ||
    error?.code === "C007" ||
    error?.code === "C005"
  );
}

export async function logout({ accessToken = getAccessToken(), signal } = {}) {
  try {
    const response = await requestJson({
      path: LOGOUT_ENDPOINT,
      method: "POST",
      accessToken,
      signal,
      errorMessage: "로그아웃에 실패했습니다.",
    });

    clearAuthTokens();

    return response;
  } catch (error) {
    if (isAuthError(error)) {
      clearAuthTokens();
    }

    throw error;
  }
}
