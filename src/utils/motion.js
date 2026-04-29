export function readPrefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function supportsHoverReviewPreview() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia('(hover: hover)').matches;
}

export function createShootingStar() {
  const angle = -28 + (Math.random() * 40 - 20);
  const startX = 10 + Math.random() * 80;
  const startY = 5 + Math.random() * 30;
  const length = 60 + Math.random() * 120;
  const duration = 900 + Math.random() * 700;
  const rad = (angle * Math.PI) / 180;

  return {
    id: `star-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    startX,
    startY,
    angle,
    length,
    duration,
    scale: 0.72 + Math.random() * 0.54,
    opacity: 0.46 + Math.random() * 0.38,
    travelX: Math.cos(rad) * length * 2.4,
    travelY: Math.sin(rad) * length * 2.4,
  };
}

export function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(31, hash) + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}
