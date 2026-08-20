/*
 비밀번호 변경 api , PATCH
 /api/mypage/password
 요청 :
 {
  "currentPassword": "onetatest123",
  "newPassword": "onetatest12345",
  "newPasswordConfirm": "onetatest12345"
 }
  성공 응답 예시 :
  200
  {
  "code": "SUCCESS",
  "message": "요청이 성공적으로 처리되었습니다."
  }
  에러 응답 예시 :
  400
  {
  "code": "C002",
  "message": "잘못된 입력값입니다.",
  "data": {
    "currentPassword": "현재 비밀번호는 필수 입력값입니다."
  }
  }
  400
  {
  "code": "C002",
  "message": "잘못된 입력값입니다.",
  "data": {
    "newPassword": "새 비밀번호는 필수 입력값입니다."
  }
  }
  400
  {
  "code": "C002",
  "message": "잘못된 입력값입니다.",
  "data": {
    "newPasswordConfirm": "새 비밀번호 확인은 필수 입력값입니다."
  }
  }
  400
  {
  "code": "C002",
  "message": "잘못된 입력값입니다.",
  "data": {
    "newPassword": "비밀번호는 영문 대소문자, 숫자, 특수문자 중 2가지 이상을 조합하여 8~16자로 입력해주세요. (공백 사용 불가)"
  }
 }
  400
  {
  "code": "C002",
  "message": "새 비밀번호가 서로 일치하지 않습니다."
 }
  400
  {
  "code": "C002",
  "message": "가입되지 않은 이메일입니다."
 }
  400
  {
  "code": "C002",
  "message": "소셜 로그인으로 가입한 회원은 비밀번호를 변경할 수 없습니다."
 }
  400
  {
  "code": "C002",
  "message": "현재 비밀번호가 일치하지 않습니다."
 }
  400
  {
  "code": "C002",
  "message": "새 비밀번호는 기존 비밀번호와 다르게 설정해야 합니다."
 }
  401
  {
  "code": "C007",
  "message": "인증이 필요합니다."
 }
  403
  {
  "code": "C005",
  "message": "인증 정보가 없습니다."
 }
  500
  {
  "code": "C001",
  "message": "서버 내부 오류가 발생했습니다."
 }
*/
import { getAccessToken } from "../auth/tokens";
import { requestJson } from "../client";

const PASSWORD_ENDPOINT = "/api/mypage/password";

function validatePasswordPayload({ currentPassword, newPassword, newPasswordConfirm } = {}) {
  const errors = {};

  if (!currentPassword) {
    errors.currentPassword = "현재 비밀번호는 필수 입력값입니다.";
  }

  if (!newPassword) {
    errors.newPassword = "새 비밀번호는 필수 입력값입니다.";
  }

  if (!newPasswordConfirm) {
    errors.newPasswordConfirm = "새 비밀번호 확인은 필수 입력값입니다.";
  }

  if (newPassword && newPasswordConfirm && newPassword !== newPasswordConfirm) {
    errors.newPasswordConfirm = "새 비밀번호가 서로 일치하지 않습니다.";
  }

  return Object.keys(errors).length ? errors : null;
}

export async function changePassword({
  currentPassword,
  newPassword,
  newPasswordConfirm,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  const validation = validatePasswordPayload({ currentPassword, newPassword, newPasswordConfirm });

  if (validation) {
    const error = new Error("잘못된 입력값입니다.");
    error.code = "C002";
    error.data = validation;
    throw error;
  }

  const body = { currentPassword, newPassword, newPasswordConfirm };

  const response = await requestJson({
    path: PASSWORD_ENDPOINT,
    method: "PATCH",
    body,
    accessToken,
    signal,
    errorMessage: "비밀번호 변경에 실패했습니다.",
  });

  return response;
}
