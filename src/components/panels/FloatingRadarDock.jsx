import { useRef, useState, useEffect } from 'react';
import { clamp } from '../../utils/math.js';
import {
  uiInsetFor,
  scoreDockSizeFor,
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
import { SketchRadarIcon } from '../icons/index.jsx';
import { PortfolioScoreCard } from '../cards/PortfolioScoreCard.jsx';

export function FloatingRadarDock({
  anchorRef,
  anchorPosition,
  anchorSize,
  externalDockRef,
  scorecard,
  axes,
  language,
  spawn,
  resetSignal,
  visible = true,
  onPositionChange,
  onInteract,
}) {
  const dockRef = useRef(null);
  const hasUserMovedRef = useRef(false);
  const storageKey = STORAGE_KEYS.scoreDockPosition;
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
      return { x: 0, y: 202 };
    }

    const scoreSize = scoreDockSizeFor(window.innerWidth);
    const previousDockSize = anchorSize ?? groupDockSizeFor(window.innerWidth);
    const triggerSize = toolTriggerSizeFor(window.innerWidth);
    if (anchorPosition) {
      return stackDockBelow(
        anchorPosition.x,
        anchorPosition.y,
        previousDockSize,
        scoreSize,
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
        scoreSize,
        window.innerWidth,
        window.innerHeight,
        3,
      );
    }

    return stackDockBelowRect(
      rect,
      triggerSize,
      scoreSize,
      window.innerWidth,
      window.innerHeight,
      3,
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

  const assignDockRef = (node) => {
    dockRef.current = node;

    if (!externalDockRef) {
      return;
    }

    if (typeof externalDockRef === 'function') {
      externalDockRef(node);
      return;
    }

    externalDockRef.current = node;
  };

  const clampDockPosition = (nextX, nextY, options = {}) => {
    const margin = 18;
    const dockSize = scoreDockSizeFor(window.innerWidth);
    const panel = dockRef.current?.querySelector('.score-panel--floating');
    const shouldIncludePanel = options.expanded ?? expanded;
    const panelWidth = shouldIncludePanel ? panel?.offsetWidth ?? 308 : 0;
    const panelSide = shouldIncludePanel
      ? floatingPanelSideFor(nextX, dockSize, window.innerWidth)
      : 'right';
    const panelReachX = shouldIncludePanel ? Math.max(0, panelWidth - 11.2) : 0;
    const width = dockSize + panelReachX;
    const height = shouldIncludePanel ? Math.max(panel?.offsetHeight ?? dockSize, 308) : dockSize;
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

  const commitPosition = (nextPosition) => {
    setPosition((current) => {
      const resolved =
        typeof nextPosition === 'function' ? nextPosition(current) : nextPosition;
      onPositionChange?.(resolved);
      return resolved;
    });
  };

  const snapToAnchor = () => {
    hasUserMovedRef.current = false;
    clearStoredPosition(storageKey);
    const anchored = anchoredPosition();
    commitPosition(clampDockPosition(anchored.x, anchored.y, { expanded: false }));
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const syncPosition = () => {
      commitPosition((current) => {
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
  }, [anchorRef, anchorPosition?.x, anchorPosition?.y, anchorSize, expanded]);

  useEffect(() => {
    if (!spawn) {
      return;
    }

    hasUserMovedRef.current = true;
    setExpanded(true);
    commitPosition((current) => clampDockPosition(spawn.x ?? current.x, spawn.y ?? current.y));
  }, [spawn?.session]);

  useEffect(() => {
    if (!resetSignal) {
      return;
    }

    hasUserMovedRef.current = false;
    clearStoredPosition(storageKey);
    setExpanded(false);
    const anchored = anchoredPosition();
    commitPosition(clampDockPosition(anchored.x, anchored.y));
  }, [resetSignal, storageKey]);

  useEffect(() => {
    onPositionChange?.(position);
  }, [onPositionChange, position]);

  useEffect(() => {
    if (typeof window === 'undefined' || dragging || !hasUserMovedRef.current) {
      return;
    }

    writeStoredPosition(storageKey, position);
  }, [dragging, position, storageKey]);

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
    commitPosition(
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
      onInteract();
      commitPosition(
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
        snapToAnchor();
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
  }, [anchorPosition?.x, anchorPosition?.y, anchorSize, expanded, onInteract]);

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
    pressRef.current.holdTimer =
      Number.isFinite(holdDelay) && holdDelay >= 0
        ? window.setTimeout(beginDrag, holdDelay)
        : null;
  };

  const handleDockPointerDown = (event) => {
    startPress(event, 'toggle', { capture: true, preventDefault: true, stopPropagation: true, holdDelay: null });
  };

  const handleDockSurfacePointerDown = (event) => {
    startPress(event, 'drag', { capture: false, preventDefault: false, stopPropagation: true, holdDelay: 90 });
  };

  const panelSide =
    typeof window === 'undefined'
      ? 'right'
      : floatingPanelSideFor(position.x, scoreDockSizeFor(window.innerWidth), window.innerWidth);

  return (
    <div
      ref={assignDockRef}
      className={`score-dock${panelSide === 'left' ? ' is-flipped' : ''}${expanded ? ' is-expanded' : ''}${dragging ? ' is-dragging' : ''}${visible ? '' : ' is-hidden'}`}
      style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
    >
      <button
        type="button"
        className="score-dock__handle"
        onPointerDown={handleDockPointerDown}
        aria-expanded={expanded}
      >
        <SketchRadarIcon scorecard={scorecard} axes={axes} />
      </button>

      <PortfolioScoreCard
        scorecard={scorecard}
        axes={axes}
        language={language}
        className={`score-panel score-panel--floating${expanded ? ' is-open' : ''}`}
        onPointerDown={handleDockSurfacePointerDown}
      />
    </div>
  );
}
