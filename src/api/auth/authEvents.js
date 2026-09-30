const authRequiredListeners = new Set();

export function subscribeAuthRequired(listener) {
  authRequiredListeners.add(listener);

  return () => authRequiredListeners.delete(listener);
}

export function notifyAuthRequired(reason) {
  authRequiredListeners.forEach((listener) => listener(reason));
}
