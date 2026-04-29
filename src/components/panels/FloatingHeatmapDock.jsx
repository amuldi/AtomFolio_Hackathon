import { useRef, useState, useEffect } from 'react';
import { clamp } from '../../utils/math.js';
import {
  uiInsetFor,
  heatmapDockSizeFor,
  scoreDockSizeFor,
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
import { STORAGE_KEYS, MOBILE_BREAKPOINT } from '../../constants/ui.js';
import { textFor } from '../../utils/format.js';
import { SketchHeatmapIcon } from '../icons/index.jsx';
import { HeatmapCard } from '../cards/HeatmapCard.jsx';

export function FloatingHeatmapDock({
  anchorRef,
  anchorPosition,
  anchorSize,
  heatmap,
  language,
  visible = true,
  resetSignal,
  iconOnly = false,
  onAnchorPositionChange,
  onInteract,
}) {
  const dockRef = useRef(null);
  const hasUserMovedRef = useRef(false);
  const storageKey = STORAGE_KEYS.heatmapDockPosition;
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

    const dockSize = heatmapDockSizeFor(window.innerWidth);
    const previousDockSize = anchorSize ?? scoreDockSizeFor(window.innerWidth);

    if (anchorPosition) {
      return stackDockBelow(
        anchorPosition.x,
        anchorPosition.y,
        previousDockSize,
        dockSize,
        window.innerWidth,
        window.innerHeight,
      );
    }

    const rect = anchorRef?.current?.getBoundingClientRect();

    if (rect) {
      return stackDockBelowRect(
        rect,
        toolTriggerSizeFor(window.innerWidth),
        dockSize,
        window.innerWidth,
        window.innerHeight,
        2,
      );
    }

    const inset = uiInsetFor(window.innerWidth);
    return stackDockBelow(
      inset,
      inset,
      toolTriggerSizeFor(window.innerWidth),
      dockSize,
      window.innerWidth,
      window.innerHeight,
      2,
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
    const dockSize = heatmapDockSizeFor(window.innerWidth);
    const panel = dockRef.current?.querySelector('.heatmap-panel--floating');
    const panelWidth = !iconOnly && expanded ? panel?.offsetWidth ?? 280 : 0;
    const panelSide =
      !iconOnly && expanded
        ? floatingPanelSideFor(nextX, dockSize, window.innerWidth)
        : 'right';
    const panelReachX =
      !iconOnly && expanded
        ? Math.max(0, panelWidth + (window.innerWidth <= MOBILE_BREAKPOINT ? -4 : 8))
        : 0;
    const width = dockSize + panelReachX;
    const height = !iconOnly && expanded ? Math.max(panel?.offsetHeight ?? dockSize, 208) : dockSize;
    const offsetX = panelSide === 'left' ? -panelReachX : 0;

    return {
      x: clamp(
        nextX,
        margin - offsetX,
        Math.max(margin - offsetX, window.innerWidth - width - margin - offsetX),
      ),
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
  }, [anchorRef, anchorPosition?.x, anchorPosition?.y, anchorSize, expanded, iconOnly]);

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
        if (distanceSquared > 9 || performance.now() - pressRef.current.pressAt > 90) {
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

      if (wasClick && action === 'toggle' && !iconOnly) {
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
  }, [expanded, iconOnly, onInteract]);

  const startPress = (event, action, options = {}) => {
    const {
      capture = false,
      preventDefault = false,
      stopPropagation = false,
      holdDelay = 90,
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
    startPress(event, 'toggle', { capture: true, preventDefault: true, stopPropagation: true, holdDelay: 90 });
  };

  const handleDockSurfacePointerDown = (event) => {
    startPress(event, 'drag', { capture: false, preventDefault: false, stopPropagation: true, holdDelay: 90 });
  };

  const panelSide =
    typeof window === 'undefined'
      ? 'right'
      : floatingPanelSideFor(position.x, heatmapDockSizeFor(window.innerWidth), window.innerWidth);

  return (
    <div
      ref={dockRef}
      className={`heatmap-dock${panelSide === 'left' ? ' is-flipped' : ''}${expanded ? ' is-expanded' : ''}${dragging ? ' is-dragging' : ''}${visible ? '' : ' is-hidden'}`}
      style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
    >
      <button
        type="button"
        className="heatmap-dock__handle"
        onPointerDown={handleDockPointerDown}
        aria-expanded={expanded}
        aria-label={iconOnly ? textFor(language).contributionAria : textFor(language).heatmapAria}
      >
        <SketchHeatmapIcon heatmap={heatmap} />
      </button>

      {!iconOnly ? (
        <HeatmapCard
          heatmap={heatmap}
          language={language}
          className={`heatmap-panel heatmap-panel--floating${expanded ? ' is-open' : ''}`}
          onPointerDown={handleDockSurfacePointerDown}
        />
      ) : null}
    </div>
  );
}
