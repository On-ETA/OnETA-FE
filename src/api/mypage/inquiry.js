/*
 문의하기 API
 POST /api/mypage/inquiry

 Request body:
 {
   "title": "Inquiries Test-title",
   "content": "Inquiries Test-content"
 }
*/

import { getAccessToken } from "../auth/tokens";
import { requestJson } from "../client";

const INQUIRY_ENDPOINT = "/api/mypage/inquiry";

export async function sendInquiry({
  title,
  content,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  return requestJson({
    path: INQUIRY_ENDPOINT,
    method: "POST",
    body: {
      title: title?.trim() ?? "",
      content: content?.trim() ?? "",
    },
    accessToken,
    signal,
    errorMessage: "문의 전송에 실패했습니다.",
  });
}
