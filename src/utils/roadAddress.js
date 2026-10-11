export function parseRoadAddress(value) {
  const address = value?.trim?.().replace(/\s+/g, " ") ?? "";
  const match = address.match(/(?:^|\s)([가-힣A-Za-z0-9·.]+(?:로|길))\s+(?:지하\s*)?(\d+(?:-\d+)?)(?=\s|$)/u);
  return match ? { address, street: match[1], buildingNumber: match[2] } : null;
}

export function roadAddressResult({ roadAddress, x, y } = {}) {
  const parsed = parseRoadAddress(roadAddress);
  if (!parsed || x === null || y === null || x === "" || y === "") return null;
  const longitude = Number(x), latitude = Number(y);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) ||
      longitude < 124 || longitude > 132 || latitude < 33 || latitude > 39) return null;
  return { name: parsed.address, address: parsed.address, roadAddress: parsed.address, x: longitude, y: latitude };
}

export function throwIfGeocodingAborted(signal) {
  if (signal?.aborted) {
    const error = new Error("주소 조회가 취소되었습니다.");
    error.name = "AbortError";
    throw error;
  }
}
