function parseDetails(value) {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); }
  catch { return undefined; }
}

function coordinate(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return undefined;
}

function coordinatesFromText(value) {
  if (typeof value !== "string") return {};
  // Older routes may store the endpoint as "latitude, longitude".
  const match = value.match(/^\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*$/);
  if (!match) return {};
  const y = Number(match[1]);
  const x = Number(match[2]);
  return Math.abs(y) <= 90 && Math.abs(x) <= 180 ? { x, y } : {};
}

function place(source, address, x, y) {
  const object = source && typeof source === "object" ? source : {};
  const raw = object.raw ?? {};
  const label = object.label || object.name || object.placeName ||
    (typeof source === "string" ? source : "") || object.address || address || "";
  const textCoordinates = [object.address, address, label]
    .map(coordinatesFromText)
    .find((value) => value.x !== undefined) ?? {};
  return {
    ...object,
    label,
    name: object.name ?? label,
    address: object.address || object.roadAddress || object.detail || address || label,
    x: coordinate(object.x, raw.x, object.longitude, x, textCoordinates.x),
    y: coordinate(object.y, raw.y, object.latitude, y, textCoordinates.y),
  };
}

// Detail responses may carry endpoint coordinates only on their boundary segments.
// Use the actual journey endpoints, including the initial/final walking segments.
export function getRouteSetupPlaces(initialValues = {}) {
  const values = initialValues?.data ?? initialValues ?? {};
  const details = parseDetails(values.routeDetails) ?? values.route ?? values;
  const route = details.route ?? details;
  const raw = route.raw ?? route;
  const segments = route.segments ?? raw.segments ?? [];
  const first = segments[0] ?? {};
  const last = segments[segments.length - 1] ?? {};
  const firstRaw = first.raw ?? first;
  const lastRaw = last.raw ?? last;

  return {
    origin: place(
      values.routePlaces?.origin ?? values.originPlace ?? details.originPlace ??
        details.origin ?? route.originPlace ?? route.origin,
      values.originAddress ?? details.originAddress ?? route.originAddress ?? raw.originAddress,
      coordinate(values.originX, details.originX, route.originX, raw.originX, first.startX, firstRaw.startX),
      coordinate(values.originY, details.originY, route.originY, raw.originY, first.startY, firstRaw.startY),
    ),
    destination: place(
      values.routePlaces?.destination ?? values.destinationPlace ?? details.destinationPlace ??
        details.destination ?? route.destinationPlace ?? route.destination,
      values.destinationAddress ?? details.destinationAddress ?? route.destinationAddress ?? raw.destinationAddress,
      coordinate(values.destX, details.destX, route.destX, raw.destX, last.endX, lastRaw.endX),
      coordinate(values.destY, details.destY, route.destY, raw.destY, last.endY, lastRaw.endY),
    ),
  };
}
