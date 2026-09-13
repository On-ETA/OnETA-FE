/*
  일반 회원가입, POST
  /api/auth/signup

  request:
  {
    "email": "string",
    "password": "string",
    "passwordConfirm": "string",
    "nickname": "string"
  }

  성공 응답:
  201 {
    "code": "SUCCESS",
    "message": "요청이 성공적으로 처리되었습니다",
    "data": {
      "accessToken": "{토큰값}",
      "refreshToken": "{토큰값}"
    }
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

#### 400

```json
{
  "code": "C002",
  "message": "잘못된 입력값입니다.",
  "data": {
    "password": "비밀번호는 필수 입력값입니다."
  }
}
```

#### 400

```json
{
  "code": "C002",
  "message": "잘못된 입력값입니다.",
  "data": {
    "password": "비밀번호는 영문 대소문자, 숫자, 특수문자 중 2가지 이상을 조합하여 8~16자로 입력해주세요. (공백 사용 불가)"
  }
}
```

#### 400

```json
{
  "code": "C002",
  "message": "잘못된 입력값입니다.",
  "data": {
    "nickname": "닉네임은 필수 입력값입니다."
  }
}
```

#### 400

```json
{
  "code": "C002",
  "message": "비밀번호와 비밀번호 확인이 일치하지 않습니다."
}
```

#### 400

```json
{
  "code": "C002",
  "message": "이미 사용 중인 이메일입니다."
}
```

#### 400

```json
{
  "code": "C002",
  "message": "이메일 인증 내역이 없습니다. 이메일 인증을 먼저 진행해주세요."
}
```

#### 400

```json
{
  "code": "C002",
  "message": "이메일 인증이 완료되지 않았습니다. 인증번호를 확인해 주세요."
}
```

#### 500
*/
import { requestJson } from "../client";

const SIGNUP_ENDPOINT = "/api/auth/signup";

export async function signup({
  email,
  password,
  passwordConfirm,
  nickname,
  signal,
}) {
  try {
    return await requestJson({
      path: SIGNUP_ENDPOINT,
      method: "POST",
      body: {
        email,
        password,
        passwordConfirm,
        nickname,
      },
      signal,
      errorMessage: "회원가입에 실패했습니다.",
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
    console.error("[Signup Error]", enhancedError);

    throw enhancedError;
  }
}
