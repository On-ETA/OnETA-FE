/*
  구글 간편 회원가입/로그인
  /oauth2/authorization/google

  OAuth 인증은 API 응답을 fetch로 받는 방식이 아니라,
  백엔드 인증 시작 URL로 브라우저를 이동시켜 진행합니다.
*/
import { Linking, Platform } from "react-native";

import { buildApiUrl, requestJson } from "./client";

const GOOGLE_AUTH_ENDPOINT = buildApiUrl("/oauth2/authorization/google");
const GOOGLE_CALLBACK_PATH = "/oauth/callback";
export const NATIVE_GOOGLE_REDIRECT_URI = "oneta://oauth/callback";
const GOOGLE_CODE_EXCHANGE_ENDPOINT = "/api/auth/oauth/google/exchange";

function getGoogleRedirectUri() {
  if (Platform.OS !== "web") return NATIVE_GOOGLE_REDIRECT_URI;
  if (typeof window === "undefined" || !window.location?.origin) {
    return undefined;
  }

  return `${window.location.origin}${GOOGLE_CALLBACK_PATH}`;
}

export function getGoogleAuthUrl({ redirectUri = getGoogleRedirectUri() } = {}) {
  const resolvedRedirectUri =
    redirectUri ??
    (Platform.OS === "web" ? undefined : NATIVE_GOOGLE_REDIRECT_URI);

  if (!resolvedRedirectUri) {
    return GOOGLE_AUTH_ENDPOINT;
  }

  const url = new URL(GOOGLE_AUTH_ENDPOINT);

  url.searchParams.set("redirect_uri", resolvedRedirectUri);

  return url.toString();
}

export async function exchangeGoogleAuthCode({ code, signal }) {
  if (typeof code !== "string" || !code.trim()) {
    throw new Error("Google 로그인 코드가 없습니다. 다시 로그인해 주세요.");
  }
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

  const data = response?.data;
  const hasTempId = typeof data?.tempId === "string" && Boolean(data.tempId.trim());
  const hasTokens =
    typeof data?.accessToken === "string" && Boolean(data.accessToken.trim()) &&
    typeof data?.refreshToken === "string" && Boolean(data.refreshToken.trim());

  if (!hasTempId && !hasTokens) {
    throw new Error("Google 로그인 응답에 인증 정보가 없습니다. 다시 로그인해 주세요.");
  }

  return response;
}

export async function startGoogleAuth(options) {
  const authUrl = getGoogleAuthUrl(options);

  await Linking.openURL(authUrl);

  return authUrl;
}
