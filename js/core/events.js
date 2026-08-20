const listeners = new Map();

export function on(topic, handler) {
  if (!listeners.has(topic)) listeners.set(topic, new Set());
  listeners.get(topic).add(handler);
  return () => off(topic, handler);
}

export function off(topic, handler) {
  listeners.get(topic)?.delete(handler);
}

export function emit(topic, payload) {
  listeners.get(topic)?.forEach((handler) => handler(payload));
}
