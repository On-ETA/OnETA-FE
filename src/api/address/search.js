import { getAccessToken } from "../auth/tokens";
import { reissueAuthTokens } from "../auth/reissue";
import { requestJson } from "../client";

const ADDRESS_SEARCH_ENDPOINT = "/api/addresses/search";

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

function isAuthError(error) {
  return (
    error?.status === 401 ||
    error?.status === 403 ||
    error?.code === "C007" ||
    error?.code === "C005"
  );
}

function createBusinessError(response, fallbackMessage) {
  if (!response?.code || response.code === "SUCCESS") {
    return null;
  }

  const error = new Error(response.message ?? fallbackMessage);

  error.code = response.code;
  error.data = response;

  return error;
}

async function requestAddressSearchJson(options) {
  const fallbackMessage =
    options.errorMessage ?? "주소 검색에 실패했습니다.";

  try {
    const response = await requestJson(options);
    const businessError = createBusinessError(response, fallbackMessage);

    if (businessError) {
      throw businessError;
    }

    return response;
  } catch (error) {
    if (!isAuthError(error)) {
      throw error;
    }

    try {
      const { accessToken } = await reissueAuthTokens({
        signal: options.signal,
      });
      const response = await requestJson({
        ...options,
        accessToken,
      });
      const businessError = createBusinessError(response, fallbackMessage);

      if (businessError) {
        throw businessError;
      }

      return response;
    } catch {
      throw error;
    }
  }
}

export function normalizeAddressSearchResult(result, index = 0) {
  const rawX = result?.x ?? result?.lng ?? result?.longitude ?? result?.lon;
  const rawY = result?.y ?? result?.lat ?? result?.latitude;
  const x = rawX === undefined || rawX === null ? undefined : Number(rawX);
  const y = rawY === undefined || rawY === null ? undefined : Number(rawY);
  const addressText =
    result?.address ??
    result?.roadAddress ??
    result?.jibunAddress ??
    result?.detail ??
    "";
  const name =
    result?.name ??
    result?.placeName ??
    result?.title ??
    (addressText || "주소");

  return {
    id:
      result?.id ??
      result?.addressId ??
      result?.placeId ??
      `${name}-${addressText}-${index}`,
    name,
    address: addressText,
    roadAddress: addressText,
    x,
    y,
    raw: result,
  };
}

export async function searchAddresses({
  keyword,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  const trimmedKeyword = keyword?.trim?.() ?? "";

  if (!trimmedKeyword) {
    return [];
  }

  const response = await requestAddressSearchJson({
    path: `${ADDRESS_SEARCH_ENDPOINT}${toQueryString({
      keyword: trimmedKeyword,
    })}`,
    method: "GET",
    accessToken,
    signal,
    errorMessage: "주소 검색에 실패했습니다.",
  });
  const results = Array.isArray(response?.data) ? response.data : response;

  return Array.isArray(results)
    ? results.map(normalizeAddressSearchResult)
    : [];
}
