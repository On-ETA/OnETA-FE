/*
  회원 탈퇴, DELETE
  /api/user

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
import { clearAuthTokens, getAccessToken } from "./auth/tokens";
import { requestJson } from "./client";

const USER_ENDPOINT = "/api/user";

export async function deleteUser({ accessToken = getAccessToken(), signal } = {}) {
  const data = await requestJson({
    path: USER_ENDPOINT,
    method: "DELETE",
    accessToken,
    signal,
    errorMessage: "회원 탈퇴에 실패했습니다.",
  });

  clearAuthTokens();

  return data;
}
