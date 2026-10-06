export function getArrivalNotificationPatch(previous, next) {
  return Object.fromEntries(Object.entries(next).filter(([key, value]) => {
    if (value === undefined) return false;
    const before = previous?.[key];
    if (key === "targetArrivalTime" && before != null) {
      const normalize = (time) => typeof time === "string"
        ? time.split(":").map(Number).slice(0, 3).concat([0, 0, 0]).slice(0, 3)
        : [Number(time.hour ?? 0), Number(time.minute ?? 0), Number(time.second ?? 0)];
      return JSON.stringify(normalize(before)) !== JSON.stringify(normalize(value));
    }
    if (key === "repeatDays" || key === "reminderOffsetMinutes") {
      const normalize = (items) => [...(items ?? [])].map(String).sort();
      return JSON.stringify(normalize(before)) !== JSON.stringify(normalize(value));
    }
    return JSON.stringify(before) !== JSON.stringify(value);
  }));
}
