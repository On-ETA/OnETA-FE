/*
 비밀번호 재설정(비밀번호 찾기) , POST
 /api/auth/password/reset
 요청 : 
 {
  "email": "{/api/auth/email/send}를 통해 인증번호를 받은 이메일",
  "newPassword": "newpassword123",
  "newPasswordConfirm": "newpassword123"
 }
 성공 응답:
 200
 {
  "code": "SUCCESS",
  "message": "요청이 성공적으로 처리되었습니다."
 }
 에러 응답 :
 400
 {
  "code": "C002",
  "message": "새 비밀번호와 비밀번호 확인이 일치하지 않습니다."
 }
 400
 {
  "code": "C002",
  "message": "가입되지 않은 이메일입니다."
 } 
  400
  {
  "code": "C002",
  "message": "구글 연동으로 가입된 계정입니다. 구글 로그인을 이용해주세요."
}
  400
  {
  "code": "C002",
  "message": "이메일 인증 내역이 없습니다. 인증번호 발송을 먼저 진행해주세요."
}
  400
  {
  "code": "C002",
  "message": "인증 유효 시간이 만료되었습니다. 처음부터 다시 진행해 주세요."
}
  400
  {
  "code": "C002",
  "message": "이메일 인증이 완료되지 않았습니다. 인증번호를 확인해 주세요."
}
*/
import { requestJson } from "./client";

const PASSWORD_RESET_ENDPOINT = "/api/auth/password/reset";

export async function resetPassword({
  email,
  newPassword,
  newPasswordConfirm,
  signal,
}) {
  return requestJson({
    path: PASSWORD_RESET_ENDPOINT,
    method: "POST",
    body: {
      email,
      newPassword,
      newPasswordConfirm,
    },
    signal,
    timeoutMessage:
      "비밀번호 재설정 요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.",
    errorMessage: "비밀번호 재설정에 실패했습니다.",
  });
}
