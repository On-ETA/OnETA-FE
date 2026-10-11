const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;
const HALF_DAY_MS = 12 * 60 * 60 * 1000;

export function getPreferredTransitType({ hasFirst, hasLast, now = Date.now(), types }) {
  if (hasFirst !== hasLast) return hasFirst ? types.first : types.last;
  return new Date(now + SEOUL_OFFSET_MS).getUTCHours() >= 12 ? types.last : types.first;
}

export function startFirstLastClock({ appState, onChange, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let timer;
  let disposed = false;
  let active = !appState.currentState || appState.currentState === "active";
  const update = () => {
    clearTimer(timer);
    if (disposed || !active) return;
    const timestamp = now();
    onChange(timestamp);
    timer = setTimer(update, HALF_DAY_MS - ((timestamp + SEOUL_OFFSET_MS) % HALF_DAY_MS));
  };
  const subscription = appState.addEventListener("change", state => {
    active = state === "active";
    update();
  });
  update();
  return () => { disposed = true; clearTimer(timer); subscription.remove(); };
}
