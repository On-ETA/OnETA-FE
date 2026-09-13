/*
  공지사항 세부 조회, GET
  /api/mypage/notices/{id}

  성공 응답:
  {
    "code": "SUCCESS",
    "message": "요청이 성공적으로 처리되었습니다",
    "data": {
      "author": "운영진",
      "content": "안녕하세요, 온에타(Oneta) 운영진입니다.",
      "createdAt": "2026-05-22T15:44:39",
      "id": 1,
      "title": "[필독] 온에타(Oneta) 서비스 정식 오픈 안내",
      "viewCount": 1
    }
  }

  실패 응답:
  401 {
    "code": "C007",
    "message": "인증이 필요합니다"
  }

  404 {
    "code": "N001",
    "message": "공지사항을 찾을 수 없습니다."
  }
*/
import { getAccessToken } from "../auth/tokens";
import { requestJson } from "../client";
import { normalizeNotice } from "./notice";

function buildNoticeDetailEndpoint(id) {
  return `/api/mypage/notices/${encodeURIComponent(id)}`;
}

export function normalizeNoticeDetail(notice) {
  return {
    ...normalizeNotice(notice),
    content: notice?.content ?? "",
  };
}

export async function getNoticeById({
  id,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  if (id === undefined || id === null || id === "") {
    throw new Error("공지사항 id가 필요합니다.");
  }

  const response = await requestJson({
    path: buildNoticeDetailEndpoint(id),
    method: "GET",
    accessToken,
    signal,
    errorMessage: "공지사항을 불러오지 못했습니다.",
  });

  return normalizeNoticeDetail(response?.data);
}
