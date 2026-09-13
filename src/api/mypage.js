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
import { reissueAuthTokens } from "./auth/reissue";
import { requestJson } from "./client";

const MYPAGE_ENDPOINT = "/api/mypage";

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

async function requestMyPageJson(options) {
  const fallbackMessage =
    options.errorMessage ?? "마이페이지 정보를 불러오지 못했습니다.";

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

export async function getMyPage({ accessToken = getAccessToken(), signal } = {}) {
  const data = await requestMyPageJson({
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
