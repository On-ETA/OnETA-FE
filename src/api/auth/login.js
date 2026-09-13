/*
  일반 로그인, POST
  /api/auth/login

  request:
  {
    "email": "string",
    "password": "string"
  }

  성공 응답:
  200 {
    "code": "SUCCESS",
    "message": "요청이 성공적으로 처리되었습니다",
    "data": {
      "accessToken": "{토큰값}",
      "refreshToken": "{토큰값}"
    }
  }
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
  "message": "가입되지 않은 이메일입니다."
}
```

#### 400

```json
{
  "code": "C002",
  "message": "비밀번호가 일치하지 않습니다."
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
import { requestJson } from "../client";

const LOGIN_ENDPOINT = "/api/auth/login";

export async function login({ email, password, signal }) {
  return requestJson({
    path: LOGIN_ENDPOINT,
    method: "POST",
    body: {
      email,
      password,
    },
    signal,
    errorMessage: "로그인에 실패했습니다.",
  });
}
