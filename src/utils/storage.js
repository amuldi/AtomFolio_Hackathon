export function readStoredOption(key, allowed, fallback) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const value = window.localStorage.getItem(key);
  return allowed.includes(value) ? value : fallback;
}

export function readStoredPosition(key) {
  if (!key || typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(key);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue);
    if (!Number.isFinite(parsed?.x) || !Number.isFinite(parsed?.y)) {
      return null;
    }

    return {
      x: parsed.x,
      y: parsed.y,
    };
  } catch {
    return null;
  }
}

export function writeStoredPosition(key, position) {
  if (!key || typeof window === 'undefined') {
    return;
  }

  if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) {
    return;
  }

  window.localStorage.setItem(
    key,
    JSON.stringify({
      x: Math.round(position.x),
      y: Math.round(position.y),
    }),
  );
}

export function clearStoredPosition(key) {
  if (!key || typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(key);
}
