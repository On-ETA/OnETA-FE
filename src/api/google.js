/*
  구글 간편 회원가입/로그인
  /oauth2/authorization/google

  OAuth 인증은 API 응답을 fetch로 받는 방식이 아니라,
  백엔드 인증 시작 URL로 브라우저를 이동시켜 진행합니다.
*/
import { Linking } from "react-native";

import { buildApiUrl } from "./client";

const GOOGLE_AUTH_ENDPOINT = buildApiUrl("/oauth2/authorization/google");
const SOCIAL_SIGNUP_REDIRECT_PATH = "/signup/consent";

function getSocialSignupRedirectUri() {
  if (typeof window === "undefined" || !window.location?.origin) {
    return undefined;
  }

  return `${window.location.origin}${SOCIAL_SIGNUP_REDIRECT_PATH}`;
}

export function getGoogleAuthUrl({ redirectUri = getSocialSignupRedirectUri() } = {}) {
  if (!redirectUri) {
    return GOOGLE_AUTH_ENDPOINT;
  }

  const url = new URL(GOOGLE_AUTH_ENDPOINT);

  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("redirectUri", redirectUri);

  return url.toString();
}

export async function startGoogleAuth(options) {
  const authUrl = getGoogleAuthUrl(options);

  await Linking.openURL(authUrl);

  return authUrl;
}
