/*
#### 요청

```json
{
  "newNickname": "nickname"
}
```

## 성공 응답 예시

#### 200

```json
{
  "code": "SUCCESS",
  "message": "요청이 성공적으로 처리되었습니다."
}
```

## 에러 응답 예시

#### 400

```json
{
  "code": "C002",
  "message": "잘못된 입력값입니다.",
  "data": {
    "newNickname": "새로운 닉네임을 입력해주세요."
  }
}
```

#### 400

```json
{
  "code": "C002",
  "message": "잘못된 입력값입니다.",
  "data": {
    "newNickname": "닉네임은 2자 이상 10자 이하로 입력해주세요."
  }
}
```

#### 400

```json
{
  "code": "C002",
  "message": "잘못된 입력값입니다.",
  "data": {
    "newNickname": "닉네임은 특수문자와 공백을 포함할 수 없습니다."
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

#### 401

```json
{
  "code": "C007",
  "message": "인증이 필요합니다."
}
```

#### 403

```json
{
  "code": "C005",
  "message": "인증 정보가 없습니다."
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
import { getAccessToken } from "../auth/tokens";
import { requestJson } from "../client";

const NICKNAME_ENDPOINT = "/api/mypage/nickname";
const NICKNAME_PATTERN = /^[A-Za-z0-9가-힣ㄱ-ㅎㅏ-ㅣ]+$/;

function validateNicknamePayload({ newNickname } = {}) {
  const errors = {};
  const trimmedNickname =
    typeof newNickname === "string" ? newNickname.trim() : "";

  if (!trimmedNickname) {
    errors.newNickname = "새로운 닉네임을 입력해주세요.";
  } else if (trimmedNickname.length < 2 || trimmedNickname.length > 10) {
    errors.newNickname = "닉네임은 2자 이상 10자 이하로 입력해주세요.";
  } else if (!NICKNAME_PATTERN.test(trimmedNickname)) {
    errors.newNickname = "닉네임은 특수문자와 공백을 포함할 수 없습니다.";
  }

  return Object.keys(errors).length ? errors : null;
}

export async function changeNickname({
  newNickname,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  const trimmedNickname =
    typeof newNickname === "string" ? newNickname.trim() : "";
  const validation = validateNicknamePayload({
    newNickname: trimmedNickname,
  });

  if (validation) {
    const error = new Error("잘못된 입력값입니다.");
    error.code = "C002";
    error.data = {
      code: "C002",
      message: "잘못된 입력값입니다.",
      data: validation,
    };
    throw error;
  }

  return requestJson({
    path: NICKNAME_ENDPOINT,
    method: "PATCH",
    body: {
      newNickname: trimmedNickname,
    },
    accessToken,
    signal,
    errorMessage: "닉네임 변경에 실패했습니다.",
  });
}
