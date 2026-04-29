import { useRef, useState, useEffect } from 'react';
import { clamp } from '../../utils/math.js';
import { uiInsetFor, scoreDockSizeFor } from '../../utils/layout.js';
import {
  readStoredPosition,
  writeStoredPosition,
  clearStoredPosition,
} from '../../utils/storage.js';
import { STORAGE_KEYS } from '../../constants/ui.js';
import { textFor } from '../../utils/format.js';
import { SketchPlusIcon } from '../icons/index.jsx';

export function FloatingToolTrigger({
  anchorRef,
  anchorPosition,
  triggerRef,
  language,
  open,
  resetSignal,
  onToggle,
  onResetAlignment,
  onPositionChange,
  onInteract,
}) {
  const dockRef = useRef(null);
  const localTriggerRef = useRef(null);
  const hasUserMovedRef = useRef(false);
  const storageKey = STORAGE_KEYS.toolTriggerPosition;
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
    holdTimer: null,
    longPressTimer: null,
    didLongPress: false,
  });
  const [dragging, setDragging] = useState(false);

  const anchoredPosition = () => {
    if (typeof window === 'undefined') {
      return { x: 0, y: 0 };
    }

    const triggerSize = scoreDockSizeFor(window.innerWidth);
    const inset = uiInsetFor(window.innerWidth);

    return {
      x: clamp(inset, inset, window.innerWidth - triggerSize - inset),
      y: clamp(inset, inset, window.innerHeight - triggerSize - inset),
    };
  };

  const [position, setPosition] = useState(() => {
    const storedPosition = readStoredPosition(storageKey);
    if (storedPosition) {
      hasUserMovedRef.current = true;
      return storedPosition;
    }

    return anchoredPosition();
  });

  const assignTriggerRef = (node) => {
    localTriggerRef.current = node;

    if (!triggerRef) {
      return;
    }

    if (typeof triggerRef === 'function') {
      triggerRef(node);
      return;
    }

    triggerRef.current = node;
  };

  const clampTriggerPosition = (nextX, nextY) => {
    const margin = 18;
    const width = dockRef.current?.offsetWidth ?? scoreDockSizeFor(window.innerWidth);
    const height = dockRef.current?.offsetHeight ?? scoreDockSizeFor(window.innerWidth);

    return {
      x: clamp(nextX, margin, window.innerWidth - width - margin),
      y: clamp(nextY, margin, window.innerHeight - height - margin),
    };
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const syncPosition = () => {
      setPosition((current) => {
        const next = clampTriggerPosition(current.x, current.y);
        if (hasUserMovedRef.current) {
          return next;
        }

        const anchored = anchoredPosition();
        return clampTriggerPosition(anchored.x, anchored.y);
      });
    };

    const frameId = window.requestAnimationFrame(syncPosition);
    window.addEventListener('resize', syncPosition);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', syncPosition);
    };
  }, [anchorRef, anchorPosition?.x, anchorPosition?.y]);

  useEffect(() => {
    onPositionChange?.(position);
  }, [onPositionChange, position]);

  useEffect(() => {
    if (typeof window === 'undefined' || dragging || !hasUserMovedRef.current) {
      return;
    }

    writeStoredPosition(storageKey, position);
  }, [dragging, position, storageKey]);

  useEffect(() => {
    if (!resetSignal) {
      return;
    }

    hasUserMovedRef.current = false;
    clearStoredPosition(storageKey);
    setPosition(clampTriggerPosition(anchoredPosition().x, anchoredPosition().y));
  }, [resetSignal, storageKey]);

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
      clampTriggerPosition(
        pressRef.current.originX + (pressRef.current.lastX - pressRef.current.startX),
        pressRef.current.originY + (pressRef.current.lastY - pressRef.current.startY),
      ),
    );
  };

  const clearPress = () => {
    window.clearTimeout(pressRef.current.holdTimer);
    window.clearTimeout(pressRef.current.longPressTimer);
    pressRef.current.pointerId = null;
    pressRef.current.dragStarted = false;
    pressRef.current.holdTimer = null;
    pressRef.current.longPressTimer = null;
    pressRef.current.didLongPress = false;
    setDragging(false);
    document.body.style.cursor = '';
  };

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

      if (!pressRef.current.dragStarted) {
        if (distanceSquared > 9) {
          window.clearTimeout(pressRef.current.longPressTimer);
          pressRef.current.longPressTimer = null;
          beginDrag();
        } else {
          return;
        }
      }

      event.preventDefault();
      onInteract();
      setPosition(
        clampTriggerPosition(
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
      const wasLongPress = pressRef.current.didLongPress;
      const wasClick = !wasDrag && deltaX * deltaX + deltaY * deltaY < 100;

      clearPress();

      if (wasLongPress) {
        return;
      }

      if (wasClick) {
        onInteract();
        onToggle();
      }
    };

    const handleWindowPointerCancel = (event) => {
      if (pressRef.current.pointerId !== event.pointerId) {
        return;
      }

      clearPress();
    };

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: false });
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerCancel);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerCancel);
      window.clearTimeout(pressRef.current.holdTimer);
      window.clearTimeout(pressRef.current.longPressTimer);
    };
  }, [onInteract, onResetAlignment, onToggle, open]);

  const handleTriggerPointerDown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onInteract();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pressRef.current.pointerId = event.pointerId;
    pressRef.current.startX = event.clientX;
    pressRef.current.startY = event.clientY;
    pressRef.current.originX = position.x;
    pressRef.current.originY = position.y;
    pressRef.current.lastX = event.clientX;
    pressRef.current.lastY = event.clientY;
    pressRef.current.pressAt = performance.now();
    pressRef.current.dragStarted = false;
    pressRef.current.didLongPress = false;
    if (open) {
      pressRef.current.longPressTimer = window.setTimeout(() => {
        pressRef.current.didLongPress = true;
        onInteract();
        onResetAlignment?.();
      }, 320);
    }
  };

  return (
    <div
      ref={dockRef}
      className={`tool-menu tool-menu--floating${open ? ' is-open' : ''}${dragging ? ' is-dragging' : ''}`}
      style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
    >
      <button
        ref={assignTriggerRef}
        className={`tool-menu__trigger${open ? ' is-open' : ''}`}
        type="button"
        onPointerDown={handleTriggerPointerDown}
        aria-label={textFor(language).toolMenuAria}
        aria-expanded={open}
      >
        <SketchPlusIcon />
      </button>
    </div>
  );
}
