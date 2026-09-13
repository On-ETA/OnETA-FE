/*
  이용 약관 동의, POST
  /api/auth/signup/consent

  요청:
  {
    "serviceTermsAgreement": true,
    "personalInfoAgreement": true
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

  에러 응답 예시:
  400 {
    "code": "C002",
    "message": "사용자를 찾을 수 없습니다."
  }

  400 {
    "code": "C002",
    "message": "필수 약관에 모두 동의해야 서비스 이용이 가능합니다."
  }

  400 {
    "code": "C002",
    "message": "이미 정식 가입이 완료된 사용자입니다."
  }

  403 - 인증정보 누락(principal == null) (HANDLE_ACCESS_DENIED) {
    "code": "C005",
    "message": "인증되지 않은 사용자입니다."
  }
*/
import { requestJson } from "../client";

const SIGNUP_CONSENT_ENDPOINT = "/api/auth/signup/consent";

export async function agreeToSignupTerms({
  serviceTermsAgreement,
  personalInfoAgreement,
  accessToken,
  signal,
}) {
  return requestJson({
    path: SIGNUP_CONSENT_ENDPOINT,
    method: "POST",
    body: {
      serviceTermsAgreement: Boolean(serviceTermsAgreement),
      personalInfoAgreement: Boolean(personalInfoAgreement),
    },
    accessToken,
    signal,
    errorMessage: "약관 동의에 실패했습니다.",
  });
}
