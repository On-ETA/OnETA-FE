/*
  이용 약관 동의, POST
  /api/auth/signup/consent

  요청:
  {
    "serviceTermsAgreement": true,
    "serviceInfoAgreement": true
  }

  성공 응답 예시:
  200 {
    "code": "SUCCESS",
    "message": "요청이 성공적으로 처리되었습니다.",
    "data": {
      "accessToken": "{토큰값}",
      "refreshToken": "{토큰값}"
    }
  }
*/
import { requestJson } from "../client";

const SIGNUP_CONSENT_ENDPOINT = "/api/auth/signup/consent";

export async function agreeToSignupTerms({
  serviceTermsAgreement,
  serviceInfoAgreement,
  accessToken,
  signal,
}) {
  return requestJson({
    path: SIGNUP_CONSENT_ENDPOINT,
    method: "POST",
    body: {
      serviceTermsAgreement,
      serviceInfoAgreement,
    },
    accessToken,
    signal,
    errorMessage: "약관 동의에 실패했습니다.",
  });
}
