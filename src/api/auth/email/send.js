/*
  이메일 인증번호 발송, POST
  /api/auth/email/send

  요청:
  {
    "email": "string"
  }

  성공 응답 예시:
  200 {
    "code": "SUCCESS",
    "message": "요청이 성공적으로 처리되었습니다."
  }
    ## 에러 응답 예시

#### 400

```json
{
  "code": "C002",
  "message": "잘못된 입력값입니다.",
  "data": {
    "email": "이메일은 필수 입력값입니다."
  }
}
```

#### 400

```json
{
  "code": "C002",
  "message": "잘못된 입력값입니다.",
  "data": {
    "email": "올바른 이메일 형식이 아닙니다."
  }
}
```

#### 500

```json
{
  "code": "C001",
  "message": "서버 내부 오류가 발생했습니다."
}
```
*/
import { requestJson } from "../../client";

const EMAIL_SEND_ENDPOINT = "/api/auth/email/send";

export async function sendEmailVerificationCode({ email, signal }) {
  try {
    return await requestJson({
      path: EMAIL_SEND_ENDPOINT,
      method: "POST",
      body: {
        email,
      },
      signal,
      timeoutMs: 30000,
      timeoutMessage:
        "인증번호 발송 요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.",
      errorMessage: "인증번호 발송에 실패했습니다.",
    });
  } catch (error) {
    // 에러 객체에 상세 정보 추가
    const enhancedError = {
      message: error.message,
      status: error.status,
      code: error.code,
      details: error.data,
    };

    // 에러 로그 출력 (개발 환경)
    console.error("[Email Send Error]", enhancedError);

    throw enhancedError;
  }
}
