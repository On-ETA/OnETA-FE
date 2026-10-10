// A Korean query needs at least one complete syllable; other scripts are unchanged.
export function isSearchKeywordReady(keyword) {
  const value = typeof keyword === "string" ? keyword.trim().normalize("NFC") : "";
  if (!value) return false;
  const hasHangul = /[\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\uac00-\ud7a3\ud7b0-\ud7ff]/u.test(value);
  return !hasHangul || /[\uac00-\ud7a3]/u.test(value);
}
