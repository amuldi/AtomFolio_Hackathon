import { useCallback, useEffect, useRef, useState } from 'react';
import { clamp } from '../utils/math.js';
import { uiInsetFor } from '../utils/layout.js';
import { readStoredPosition, writeStoredPosition, clearStoredPosition } from '../utils/storage.js';

export function useFloatingHandle({
  initialPosition,
  fallbackSize,
  measureBounds,
  onInteract,
  onPress,
  resetSignal,
  followAnchor = true,
  continuousFollow = false,
  storageKey = null,
}) {
  const containerRef = useRef(null);
  const hasUserMovedRef = useRef(false);
  const snapContextRef = useRef({
    clearPress: null,
    clampPosition: null,
    initialPosition: null,
  });
  const pressRef = useRef({
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    lastX: 0,
    lastY: 0,
    pressAt: 0,
    dragStarted: false,
    action: 'toggle',
    holdTimer: null,
  });
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState(() => {
    if (typeof window === 'undefined') {
      return { x: 0, y: 0 };
    }

    const storedPosition = readStoredPosition(storageKey);
    if (storedPosition) {
      hasUserMovedRef.current = true;
      return storedPosition;
    }

    return initialPosition(window);
  });

  const clampPosition = (nextX, nextY) => {
    if (typeof window === 'undefined') {
      return { x: nextX, y: nextY };
    }

    const margin = uiInsetFor(window.innerWidth);
    const fallback = fallbackSize(window.innerWidth);
    const measuredBounds = measureBounds?.({
      container: containerRef.current,
      fallback,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      nextX,
      nextY,
    });
    const width =
      measuredBounds?.width ?? containerRef.current?.offsetWidth ?? fallback.width;
    const height =
      measuredBounds?.height ?? containerRef.current?.offsetHeight ?? fallback.height;
    const offsetX = measuredBounds?.offsetX ?? 0;
    const offsetY = measuredBounds?.offsetY ?? 0;

    return {
      x: clamp(
        nextX,
        margin - offsetX,
        Math.max(margin - offsetX, window.innerWidth - width - margin - offsetX),
      ),
      y: clamp(
        nextY,
        margin - offsetY,
        Math.max(margin - offsetY, window.innerHeight - height - margin - offsetY),
      ),
    };
  };

  const reusePositionIfUnchanged = (current, next) =>
    Math.abs(current.x - next.x) < 0.01 && Math.abs(current.y - next.y) < 0.01
      ? current
      : next;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    let frameId = 0;
    let cancelled = false;
    let remainingFrames = 0;

    const syncPosition = () => {
      if (cancelled) {
        return;
      }

      setPosition((current) => {
        if (hasUserMovedRef.current) {
          return reusePositionIfUnchanged(current, clampPosition(current.x, current.y));
        }

        if (!followAnchor) {
          return reusePositionIfUnchanged(current, clampPosition(current.x, current.y));
        }

        const anchored = initialPosition(window);
        return reusePositionIfUnchanged(current, clampPosition(anchored.x, anchored.y));
      });

      remainingFrames -= 1;
      if (
        followAnchor &&
        !hasUserMovedRef.current &&
        remainingFrames > 0
      ) {
        frameId = window.requestAnimationFrame(syncPosition);
        return;
      }

      frameId = 0;
    };

    const scheduleSync = (frames = continuousFollow ? 120 : 18) => {
      remainingFrames = Math.max(remainingFrames, frames);
      if (!frameId) {
        frameId = window.requestAnimationFrame(syncPosition);
      }
    };

    const handleResize = () => scheduleSync();

    scheduleSync();
    window.addEventListener('resize', handleResize);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', handleResize);
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [continuousFollow, fallbackSize, followAnchor, initialPosition, measureBounds]);

  const beginDrag = () => {
    if (pressRef.current.pointerId === null) {
      return;
    }

    window.clearTimeout(pressRef.current.holdTimer);
    pressRef.current.holdTimer = null;
    pressRef.current.dragStarted = true;
    hasUserMovedRef.current = true;
    setDragging(true);
    document.body.style.cursor = 'grabbing';
    setPosition(
      clampPosition(
        pressRef.current.originX + (pressRef.current.lastX - pressRef.current.startX),
        pressRef.current.originY + (pressRef.current.lastY - pressRef.current.startY),
      ),
    );
  };

  const clearPress = () => {
    window.clearTimeout(pressRef.current.holdTimer);
    pressRef.current.pointerId = null;
    pressRef.current.dragStarted = false;
    pressRef.current.action = 'toggle';
    pressRef.current.holdTimer = null;
    setDragging(false);
    document.body.style.cursor = '';
  };

  snapContextRef.current.clearPress = clearPress;
  snapContextRef.current.clampPosition = clampPosition;
  snapContextRef.current.initialPosition = initialPosition;

  const snapToInitial = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    snapContextRef.current.clearPress?.();
    hasUserMovedRef.current = false;
    clearStoredPosition(storageKey);
    const anchored = snapContextRef.current.initialPosition?.(window) ?? { x: 0, y: 0 };
    setPosition(snapContextRef.current.clampPosition?.(anchored.x, anchored.y) ?? anchored);
  }, [storageKey]);

  useEffect(() => {
    if (!resetSignal || typeof window === 'undefined') {
      return;
    }

    snapToInitial();
  }, [resetSignal, snapToInitial]);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !storageKey ||
      dragging ||
      !hasUserMovedRef.current
    ) {
      return;
    }

    writeStoredPosition(storageKey, position);
  }, [dragging, position, storageKey]);

  useEffect(() => {
    const handleWindowPointerMove = (event) => {
      if (pressRef.current.pointerId !== event.pointerId) {
        return;
      }

      pressRef.current.lastX = event.clientX;
      pressRef.current.lastY = event.clientY;
      const deltaX = event.clientX - pressRef.current.startX;
      const deltaY = event.clientY - pressRef.current.startY;
      const distanceSquared = deltaX * deltaX + deltaY * deltaY;
      const action = pressRef.current.action;
      const dragDistanceThreshold = action === 'toggle' ? 36 : 9;
      const shouldStartDrag =
        distanceSquared > dragDistanceThreshold ||
        (action !== 'toggle' && performance.now() - pressRef.current.pressAt > 90);

      if (!pressRef.current.dragStarted) {
        if (shouldStartDrag) {
          beginDrag();
        } else {
          return;
        }
      }

      event.preventDefault();
      onInteract?.();
      setPosition(
        clampPosition(
          pressRef.current.originX + deltaX,
          pressRef.current.originY + deltaY,
        ),
      );
    };

    const handleWindowPointerUp = (event) => {
      if (pressRef.current.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - pressRef.current.startX;
      const deltaY = event.clientY - pressRef.current.startY;
      const wasDrag = pressRef.current.dragStarted;
      const wasClick = !wasDrag && deltaX * deltaX + deltaY * deltaY < 100;
      const action = pressRef.current.action;

      clearPress();

      if (wasDrag) {
        event.preventDefault();
        return;
      }

      if (wasClick && action === 'toggle') {
        onInteract?.();
        onPress?.();
      }
    };

    const handleWindowPointerCancel = (event) => {
      if (pressRef.current.pointerId !== event.pointerId) {
        return;
      }

      clearPress();
    };

    window.addEventListener('pointermove', handleWindowPointerMove, {
      passive: false,
    });
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerCancel);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerCancel);
      window.clearTimeout(pressRef.current.holdTimer);
    };
  }, [onInteract, onPress]);

  const startPress = (event, action, options = {}) => {
    const {
      capture = false,
      preventDefault = false,
      stopPropagation = false,
      holdDelay = 90,
    } = options;

    if (preventDefault) {
      event.preventDefault();
    }

    if (stopPropagation) {
      event.stopPropagation();
    }

    onInteract?.();
    if (capture) {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    pressRef.current.pointerId = event.pointerId;
    pressRef.current.startX = event.clientX;
    pressRef.current.startY = event.clientY;
    pressRef.current.originX = position.x;
    pressRef.current.originY = position.y;
    pressRef.current.lastX = event.clientX;
    pressRef.current.lastY = event.clientY;
    pressRef.current.pressAt = performance.now();
    pressRef.current.dragStarted = false;
    pressRef.current.action = action;
    pressRef.current.holdTimer =
      Number.isFinite(holdDelay) && holdDelay >= 0
        ? window.setTimeout(beginDrag, holdDelay)
        : null;
  };

  const handlePointerDown = (event) => {
    startPress(event, 'toggle', {
      capture: true,
      preventDefault: true,
      stopPropagation: true,
      holdDelay: null,
    });
  };

  const handleDragPointerDown = (event) => {
    startPress(event, 'drag', {
      capture: false,
      preventDefault: false,
      stopPropagation: true,
      holdDelay: 90,
    });
  };

  return {
    containerRef,
    dragging,
    position,
    handlePointerDown,
    handleDragPointerDown,
    snapToInitial,
  };
}
