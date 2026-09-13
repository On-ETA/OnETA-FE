/*
  이메일 인증번호 검증, POST
  /api/auth/email/verify

  요청:
  {
    "email": "string",
    "code": "{이메일로 전송된 인증번호}"
  }

  성공 응답 예시:
  200 {
    "code": "SUCCESS",
    "message": "요청이 성공적으로 처리되었습니다."
  }
*/
import { requestJson } from "../../client";

const EMAIL_VERIFY_ENDPOINT = "/api/auth/email/verify";

export async function verifyEmailCode({ email, code, signal }) {
  return requestJson({
    path: EMAIL_VERIFY_ENDPOINT,
    method: "POST",
    body: {
      email,
      code,
    },
    signal,
    timeoutMessage:
      "인증번호 확인 요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.",
    errorMessage: "인증번호 확인에 실패했습니다.",
  });
}
