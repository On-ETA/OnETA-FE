const listeners = new Set();

export function invalidateNotifications() {
  listeners.forEach((listener) => listener());
}

export function subscribeNotifications(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
