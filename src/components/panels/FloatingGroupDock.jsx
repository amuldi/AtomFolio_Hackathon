import { useRef, useState, useEffect } from 'react';
import { clamp } from '../../utils/math.js';
import {
  uiInsetFor,
  groupDockSizeFor,
  toolTriggerSizeFor,
  stackDockBelow,
  stackDockBelowRect,
  floatingPanelSideFor,
} from '../../utils/layout.js';
import {
  readStoredPosition,
  writeStoredPosition,
  clearStoredPosition,
} from '../../utils/storage.js';
import { STORAGE_KEYS } from '../../constants/ui.js';
import { SketchBurstIcon } from '../icons/index.jsx';

export function FloatingGroupDock({
  anchorRef,
  anchorPosition,
  options,
  activeKey,
  spawn,
  resetSignal,
  visible = true,
  onAnchorPositionChange,
  onChange,
  onInteract,
}) {
  const dockRef = useRef(null);
  const hasUserMovedRef = useRef(false);
  const storageKey = STORAGE_KEYS.groupDockPosition;
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
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);

  const anchoredPosition = () => {
    if (typeof window === 'undefined') {
      return { x: 0, y: 0 };
    }

    const dockSize = groupDockSizeFor(window.innerWidth);
    const triggerSize = toolTriggerSizeFor(window.innerWidth);
    if (anchorPosition) {
      return stackDockBelow(
        anchorPosition.x,
        anchorPosition.y,
        triggerSize,
        dockSize,
        window.innerWidth,
        window.innerHeight,
      );
    }

    const rect = anchorRef?.current?.getBoundingClientRect();

    if (!rect) {
      const inset = uiInsetFor(window.innerWidth);
      return stackDockBelow(
        inset,
        inset,
        triggerSize,
        dockSize,
        window.innerWidth,
        window.innerHeight,
      );
    }

    return stackDockBelowRect(
      rect,
      triggerSize,
      dockSize,
      window.innerWidth,
      window.innerHeight,
    );
  };

  const [position, setPosition] = useState(() => {
    const storedPosition = readStoredPosition(storageKey);
    if (storedPosition) {
      hasUserMovedRef.current = true;
      return storedPosition;
    }

    return anchoredPosition();
  });

  const clampDockPosition = (nextX, nextY) => {
    const margin = 18;
    const width = dockRef.current?.offsetWidth ?? 64;
    const height = dockRef.current?.offsetHeight ?? 64;

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
        const next = clampDockPosition(current.x, current.y);
        if (hasUserMovedRef.current) {
          return next;
        }

        const anchored = anchoredPosition();
        return clampDockPosition(anchored.x, anchored.y);
      });
    };

    const frameId = window.requestAnimationFrame(syncPosition);
    window.addEventListener('resize', syncPosition);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', syncPosition);
    };
  }, [anchorRef, anchorPosition?.x, anchorPosition?.y, expanded]);

  useEffect(() => {
    if (!hasUserMovedRef.current) {
      onAnchorPositionChange?.(position);
    }
  }, [onAnchorPositionChange, position]);

  useEffect(() => {
    if (typeof window === 'undefined' || dragging || !hasUserMovedRef.current) {
      return;
    }

    writeStoredPosition(storageKey, position);
  }, [dragging, position, storageKey]);

  useEffect(() => {
    if (!spawn) {
      return;
    }

    hasUserMovedRef.current = true;
    setExpanded(true);
    setPosition((current) => clampDockPosition(spawn.x ?? current.x, spawn.y ?? current.y));
  }, [spawn?.session]);

  useEffect(() => {
    if (!resetSignal) {
      return;
    }

    hasUserMovedRef.current = false;
    clearStoredPosition(storageKey);
    setExpanded(false);
    const anchored = anchoredPosition();
    setPosition(clampDockPosition(anchored.x, anchored.y));
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
      clampDockPosition(
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
        if (distanceSquared > 36 || performance.now() - pressRef.current.pressAt > 140) {
          beginDrag();
        } else {
          return;
        }
      }

      event.preventDefault();
      onInteract();
      setPosition(
        clampDockPosition(
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
        onInteract();
        setExpanded((current) => !current);
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
    };
  }, [onInteract]);

  const startPress = (event, action, options = {}) => {
    const {
      capture = false,
      preventDefault = false,
      stopPropagation = false,
      holdDelay = 140,
    } = options;

    if (preventDefault) event.preventDefault();
    if (stopPropagation) event.stopPropagation();

    onInteract();
    if (capture) event.currentTarget.setPointerCapture?.(event.pointerId);
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
    pressRef.current.holdTimer = window.setTimeout(beginDrag, holdDelay);
  };

  const handleDockPointerDown = (event) => {
    startPress(event, 'toggle', { capture: true, preventDefault: true, stopPropagation: true, holdDelay: 140 });
  };

  const handleDockSurfacePointerDown = (event) => {
    startPress(event, 'drag', { capture: false, preventDefault: false, stopPropagation: true, holdDelay: 140 });
  };

  const panelSide =
    typeof window === 'undefined'
      ? 'right'
      : floatingPanelSideFor(position.x, groupDockSizeFor(window.innerWidth), window.innerWidth);

  return (
    <div
      ref={dockRef}
      className={`group-dock${panelSide === 'left' ? ' is-flipped' : ''}${expanded ? ' is-expanded' : ''}${dragging ? ' is-dragging' : ''}${visible ? '' : ' is-hidden'}`}
      style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
    >
      <button
        type="button"
        className="group-dock__burst"
        onPointerDown={handleDockPointerDown}
        aria-expanded={expanded}
      >
        <SketchBurstIcon />
      </button>

      <div className="group-dock__row" onPointerDown={handleDockSurfacePointerDown}>
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`group-dock__option${option.key === activeKey ? ' is-active' : ''}`}
            onClick={() => {
              onInteract();
              onChange(option.key);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
