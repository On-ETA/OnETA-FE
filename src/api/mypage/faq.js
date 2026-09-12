import { getAccessToken } from "../auth/tokens";
import { requestJson } from "../client";

const FAQS_ENDPOINT = "/api/mypage/faqs";

export function normalizeFaq(faq) {
  return {
    id: faq?.id,
    question: faq?.question ?? "",
    answer: faq?.answer ?? "",
    raw: faq,
  };
}

export async function getFaqs({ accessToken = getAccessToken(), signal } = {}) {
  const response = await requestJson({
    path: FAQS_ENDPOINT,
    method: "GET",
    accessToken,
    signal,
    errorMessage: "FAQ 목록을 불러오지 못했습니다.",
  });

  const faqs = Array.isArray(response?.data) ? response.data : response;

  return Array.isArray(faqs) ? faqs.map(normalizeFaq) : [];
}
