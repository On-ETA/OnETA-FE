/*
  구글 간편 회원가입/로그인
  /oauth2/authorization/google
  주소: https://oneta-be.onrender.com/oauth2/authorization/google

  OAuth 인증은 API 응답을 fetch로 받는 방식이 아니라,
  백엔드 인증 시작 URL로 브라우저를 이동시켜 진행합니다.
*/
import { Linking } from "react-native";

import { buildApiUrl } from "./client";

const GOOGLE_AUTH_ENDPOINT = "https://oneta-be.onrender.com/oauth2/authorization/google";

export function getGoogleAuthUrl() {
  return GOOGLE_AUTH_ENDPOINT;
}

export async function startGoogleAuth() {
  const authUrl = getGoogleAuthUrl();

  await Linking.openURL(authUrl);

  return authUrl;
}
