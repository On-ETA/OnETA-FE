/*
  공지사항 목록 조회, GET
  /api/mypage/notices

  등록된 공지가 없을 경우 빈 배열이 200 응답으로 내려옵니다.

  성공 응답:
  {
    "code": "SUCCESS",
    "message": "요청이 성공적으로 처리되었습니다",
    "data": [
      {
        "author": "운영진",
        "createdAt": "2026-05-22T15:44:39",
        "id": 1,
        "title": "[필독] 온에타(Oneta) 서비스 정식 오픈 안내",
        "viewCount": 0
      }
    ]
  }

  실패 응답:
  401 {
    "code": "C007",
    "message": "인증이 필요합니다"
  }
*/
import { getAccessToken } from "../auth/tokens";
import { requestJson } from "../client";

const NOTICES_ENDPOINT = "/api/mypage/notices";

function formatNoticeDate(createdAt) {
  if (!createdAt) {
    return "";
  }

  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = String(date.getFullYear()).slice(2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}.${month}.${day}`;
}

export function normalizeNotice(notice) {
  return {
    id: notice?.id,
    title: notice?.title ?? "",
    author: notice?.author ?? "",
    createdAt: notice?.createdAt,
    dateText: formatNoticeDate(notice?.createdAt),
    viewCount: notice?.viewCount ?? 0,
  };
}

export async function getNotices({ accessToken = getAccessToken(), signal } = {}) {
  const response = await requestJson({
    path: NOTICES_ENDPOINT,
    method: "GET",
    accessToken,
    signal,
    errorMessage: "공지사항 목록을 불러오지 못했습니다.",
  });

  const notices = Array.isArray(response?.data) ? response.data : [];

  return notices.map(normalizeNotice);
}
