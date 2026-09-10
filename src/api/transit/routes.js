import { getAccessToken } from "../auth/tokens";
import { requestJson } from "../client";

const TRANSIT_ROUTES_SEARCH_ENDPOINT = "/api/transit/routes/search";

function toQueryString(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.append(key, value);
    }
  });

  const queryString = query.toString();

  return queryString ? `?${queryString}` : "";
}

export async function searchTransitRoutes({
  keyword,
  params,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  return requestJson({
    path: `${TRANSIT_ROUTES_SEARCH_ENDPOINT}${toQueryString({
      keyword,
      query: keyword,
      ...params,
    })}`,
    method: "GET",
    accessToken,
    signal,
    errorMessage: "대중교통 경로 검색에 실패했습니다.",
  });
}
