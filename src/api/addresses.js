import { getAccessToken } from "./auth/tokens";
import { requestJson } from "./client";

const ADDRESSES_ENDPOINT = "/api/addresses";

function buildAddressEndpoint(addressId) {
  return `${ADDRESSES_ENDPOINT}/${encodeURIComponent(addressId)}`;
}

function buildCurrentAddressEndpoint(addressId) {
  return `${buildAddressEndpoint(addressId)}/current`;
}

function compactPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(
      ([, value]) => value !== undefined && value !== null,
    ),
  );
}

export function normalizeAddress(address) {
  const addressId = address?.addressId ?? address?.id;
  const addressText =
    address?.address ??
    address?.detail ??
    address?.roadAddress ??
    address?.jibunAddress ??
    "";
  const isCurrent =
    address?.current ?? address?.isCurrent ?? address?.currentAddress ?? false;

  return {
    id: addressId,
    addressId,
    name: address?.name ?? address?.addressName ?? address?.title ?? "주소 이름",
    detail: addressText,
    address: addressText,
    placeName: address?.placeName ?? address?.name ?? "주소",
    current: isCurrent,
    isCurrent,
    x: address?.x,
    y: address?.y,
    raw: address,
  };
}

export async function getAddresses({
  accessToken = getAccessToken(),
  signal,
} = {}) {
  const response = await requestJson({
    path: ADDRESSES_ENDPOINT,
    method: "GET",
    accessToken,
    signal,
    errorMessage: "주소 목록을 불러오지 못했습니다.",
  });

  const addresses = Array.isArray(response?.data) ? response.data : response;

  return Array.isArray(addresses) ? addresses.map(normalizeAddress) : [];
}

export async function createAddress({
  name,
  address,
  x,
  y,
  payload,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  return requestJson({
    path: ADDRESSES_ENDPOINT,
    method: "POST",
    body: payload ?? {
      name,
      address,
      x,
      y,
    },
    accessToken,
    signal,
    errorMessage: "주소 등록에 실패했습니다.",
  });
}

export async function updateAddress({
  addressId,
  name,
  address,
  x,
  y,
  payload,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  if (addressId === undefined || addressId === null || addressId === "") {
    throw new Error("주소 id가 필요합니다.");
  }

  return requestJson({
    path: buildAddressEndpoint(addressId),
    method: "PATCH",
    body: payload ?? compactPayload({
      name,
      address,
      x,
      y,
    }),
    accessToken,
    signal,
    errorMessage: "주소 수정에 실패했습니다.",
  });
}

export async function deleteAddress({
  addressId,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  if (addressId === undefined || addressId === null || addressId === "") {
    throw new Error("주소 id가 필요합니다.");
  }

  return requestJson({
    path: buildAddressEndpoint(addressId),
    method: "DELETE",
    accessToken,
    signal,
    errorMessage: "주소 삭제에 실패했습니다.",
  });
}

export async function setCurrentAddress({
  addressId,
  accessToken = getAccessToken(),
  signal,
} = {}) {
  if (addressId === undefined || addressId === null || addressId === "") {
    throw new Error("주소 id가 필요합니다.");
  }

  return requestJson({
    path: buildCurrentAddressEndpoint(addressId),
    method: "PUT",
    accessToken,
    signal,
    errorMessage: "현재 주소 설정에 실패했습니다.",
  });
}
