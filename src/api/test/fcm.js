import { getAccessToken } from "../auth/tokens";
import { reissueAuthTokens } from "../auth/reissue";
import { requestJson } from "../client";

const TEST_FCM_ENDPOINT = "/api/test/fcm";
export const DEFAULT_TEST_FCM_TITLE = "테스트 알림";
export const DEFAULT_TEST_FCM_BODY = "이것은 OnETA 테스트 푸시입니다!";

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

async function requestTestFcmJson(options) {
  const fallbackMessage = options.errorMessage ?? "테스트 FCM 발송에 실패했습니다.";

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
    } catch {
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

function buildTestFcmEndpoint({ title, body } = {}) {
  const query = new URLSearchParams();
  const trimmedTitle = title?.trim();
  const trimmedBody = body?.trim();

  if (trimmedTitle) {
    query.append("title", trimmedTitle);
  }

  if (trimmedBody) {
    query.append("body", trimmedBody);
  }

  const queryString = query.toString();

  return queryString ? `${TEST_FCM_ENDPOINT}?${queryString}` : TEST_FCM_ENDPOINT;
}

export async function sendTestFcm({
  title = DEFAULT_TEST_FCM_TITLE,
  body = DEFAULT_TEST_FCM_BODY,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  return requestTestFcmJson({
    path: buildTestFcmEndpoint({ title, body }),
    method: "POST",
    accessToken,
    signal,
    errorMessage: "테스트 FCM 발송에 실패했습니다.",
  });
}
