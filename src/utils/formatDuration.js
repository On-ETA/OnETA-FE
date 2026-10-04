export function formatDurationMinutes(value) {
  if (!Number.isFinite(value) || value < 0) return "--";
  const totalMinutes = Math.ceil(value);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
}
