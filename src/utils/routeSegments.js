export function getSegmentDurationMinutes(segment) {
  const value =
    segment?.durationMinutes ??
    segment?.walkTime ??
    segment?.walkingTime ??
    segment?.walkDurationMinutes ??
    segment?.walkDuration ??
    segment?.duration ??
    segment?.time ??
    segment?.raw?.durationMinutes ??
    segment?.raw?.walkTime ??
    segment?.raw?.walkingTime ??
    segment?.raw?.walkDurationMinutes ??
    segment?.raw?.walkDuration ??
    segment?.raw?.duration ??
    segment?.raw?.time;
  const number = Number(value);

  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

export function normalizeTimelineSegments(routeSegments = []) {
  return routeSegments
    .map((segment, index) => ({
      ...segment,
      id: segment?.id ?? `${segment?.transitType ?? "segment"}-${index}`,
      durationMinutes: getSegmentDurationMinutes(segment),
    }))
    .filter(
      (segment) =>
        segment.transitType !== "WALK" ||
        Number(segment.durationMinutes ?? 0) > 0,
    );
}
