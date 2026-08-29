/*
  마이페이지 화면 정보 조회, GET
  /api/mypage

  성공 응답:
  {
    "appVersion": "1.0.1",
    "email": "string",
    "nickname": "홍길동644"
  }

  실패 응답:
  401 {
    "code": "C007",
    "message": "인증이 필요합니다"
  }
*/
import { getAccessToken } from "./auth/tokens";
import { requestJson } from "./client";

const MYPAGE_ENDPOINT = "/api/mypage";

export async function getMyPage({ accessToken = getAccessToken(), signal } = {}) {
  const data = await requestJson({
    path: MYPAGE_ENDPOINT,
    method: "GET",
    accessToken,
    signal,
    errorMessage: "마이페이지 정보를 불러오지 못했습니다.",
  });

  const myPageData = data?.data ?? data;

  return {
    appVersion: myPageData?.appVersion,
    email: myPageData?.email,
    nickname: myPageData?.nickname,
  };
}
