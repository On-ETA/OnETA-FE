import { normalizeTimelineSegments } from "./routeSegments";

function numberValue(source, key) {
  const value = source?.[key] ?? source?.raw?.[key];
  if (value === null || value === undefined || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

function clock(timestamp) {
  if (!Number.isFinite(timestamp)) return undefined;
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function parseEstimatedDepartureAt(value) {
  if (typeof value !== "string" || !value) return undefined;

  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : undefined;
  }

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/,
  );
  if (!match) return undefined;

  const [, year, month, day, hour, minute, second = "0", fraction = "0"] = match;
  const milliseconds = Number(`0.${fraction}`) * 1000;

  return Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour) - 9,
    Number(minute),
    Number(second),
    milliseconds,
  );
}

export function formatSeoulTime(timestamp) {
  if (!Number.isFinite(timestamp)) return undefined;

  const date = new Date(timestamp + 9 * 60 * 60 * 1000);
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(
    date.getUTCMinutes(),
  ).padStart(2, "0")}`;
}

function timeValue(source, key) {
  const value = source?.[key] ?? source?.raw?.[key];
  if (typeof value === "string" && /^\d{1,2}:\d{2}/.test(value)) {
    const [hour, minute] = value.split(":");
    return `${hour.padStart(2, "0")}:${minute}`;
  }
  if (value && Number.isInteger(value.hour) && Number.isInteger(value.minute)) {
    return `${String(value.hour).padStart(2, "0")}:${String(value.minute).padStart(2, "0")}`;
  }
  return undefined;
}

function stopName(segment, edge) {
  return edge === "start"
    ? segment.startStation || segment.stations?.[0]?.name || ""
    : segment.endStation || segment.stations?.[segment.stations.length - 1]?.name || "";
}

export function createFirstLastRouteSummary(route, places = {}, now = Date.now()) {
  const segments = normalizeTimelineSegments(route?.segments ?? []);
  const transitSegments = segments.filter(segment => segment.transitType !== "WALK");
  const primarySegment = transitSegments[0];
  const firstTransitIndex = segments.indexOf(primarySegment);
  const initialWalkMinutes = segments.slice(0, Math.max(firstTransitIndex, 0))
    .reduce((sum, segment) => sum + (numberValue(segment, "durationMinutes") ?? 0), 0);
  const arrivalSeconds = numberValue(primarySegment, "realTimeArrivalSeconds");
  const liveDeparture = arrivalSeconds === undefined
    ? undefined
    : now + arrivalSeconds * 1000 - initialWalkMinutes * 60000;
  const previewDeparture = places.departureTimestamp ?? now;
  const totalDurationMinutes = numberValue(route, "realTimeDurationMinutes")
    ?? numberValue(route, "totalDurationMinutes");

  return {
    remainingTimeUpdatedAt: now,
    route,
    segments,
    transitLegs: transitSegments.map((segment, index) => ({
      id: segment.id ?? `${segment.transitType}-${index}`,
      routeNumber: segment.transitName || "대중교통",
      routeDirection: stopName(segment, "end") ? `${stopName(segment, "end")} 방면` : "",
      boardingStopName: stopName(segment, "start"),
      arrivalStopName: stopName(segment, "end"),
      boardingTime: timeValue(segment, "boardingTime") ?? timeValue(segment, "startTime"),
      arrivalTime: timeValue(segment, "arrivalTime") ?? timeValue(segment, "endTime"),
    })),
    totalDurationMinutes,
    remainingMinutes: numberValue(route, "remainingMinutes")
      ?? numberValue(route, "remainingTimeMinutes")
      ?? (liveDeparture === undefined ? undefined : Math.max(0, Math.ceil((liveDeparture - now) / 60000))),
    departureTime: timeValue(route, "departureTime") ?? timeValue(route, "startTime")
      ?? clock(previewDeparture),
    // The result card's estimate includes the entire route, including transfers/waits.
    arrivalTime: timeValue(route, "arrivalTime") ?? timeValue(route, "endTime")
      ?? (totalDurationMinutes === undefined ? undefined : clock(previewDeparture + totalDurationMinutes * 60000)),
    preDepartureAlarmMinutes: 10,
  };
}

export function getCorrectedRemainingMinutes(summary, now = Date.now()) {
  if (Number.isFinite(summary?.estimatedDepartureTimestamp)) {
    return Math.max(0, Math.ceil((summary.estimatedDepartureTimestamp - now) / 60000));
  }
  if (!Number.isFinite(summary?.remainingMinutes)) return undefined;
  const elapsed = Number.isFinite(summary?.remainingTimeUpdatedAt)
    ? Math.max(0, now - summary.remainingTimeUpdatedAt) / 60000 : 0;
  return Math.max(0, Math.ceil(summary.remainingMinutes - elapsed));
}
