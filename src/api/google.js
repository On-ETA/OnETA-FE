/*
  구글 간편 회원가입/로그인
  /oauth2/authorization/google

  OAuth 인증은 API 응답을 fetch로 받는 방식이 아니라,
  백엔드 인증 시작 URL로 브라우저를 이동시켜 진행합니다.
*/
import { Linking, Platform } from "react-native";

import { buildApiUrl, requestJson } from "./client";

const GOOGLE_AUTH_ENDPOINT = buildApiUrl("/oauth2/authorization/google");
const SOCIAL_SIGNUP_REDIRECT_PATH = "/signup/consent";
export const NATIVE_GOOGLE_REDIRECT_URI = "oneta://oauth/callback";
const GOOGLE_CODE_EXCHANGE_ENDPOINT = "/api/auth/oauth/google/exchange";

function getSocialSignupRedirectUri() {
  if (typeof window === "undefined" || !window.location?.origin) {
    return undefined;
  }

  return `${window.location.origin}${SOCIAL_SIGNUP_REDIRECT_PATH}`;
}

export function getGoogleAuthUrl({ redirectUri = getSocialSignupRedirectUri() } = {}) {
  const resolvedRedirectUri =
    redirectUri ??
    (Platform.OS === "web" ? undefined : NATIVE_GOOGLE_REDIRECT_URI);

  if (!resolvedRedirectUri) {
    return GOOGLE_AUTH_ENDPOINT;
  }

  const url = new URL(GOOGLE_AUTH_ENDPOINT);

  url.searchParams.set("redirect_uri", resolvedRedirectUri);
  url.searchParams.set("redirectUri", resolvedRedirectUri);

  return url.toString();
}

export async function exchangeGoogleAuthCode({ code, signal }) {
  const response = await requestJson({
    path: GOOGLE_CODE_EXCHANGE_ENDPOINT,
    method: "POST",
    body: { code },
    signal,
    errorMessage: "Google 로그인 확인에 실패했습니다.",
  });

  if (response?.code && response.code !== "SUCCESS") {
    throw new Error(response.message ?? "Google 로그인 확인에 실패했습니다.");
  }

  return response;
}

export async function startGoogleAuth(options) {
  const authUrl = getGoogleAuthUrl(options);

  await Linking.openURL(authUrl);

  return authUrl;
}
