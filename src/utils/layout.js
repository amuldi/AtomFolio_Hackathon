import { MOBILE_BREAKPOINT } from '../constants/ui.js';
import {
  LARGE_SCENE_ATOM_THRESHOLD,
  SCENE_FRAME_INTERVAL_MS,
  LARGE_SCENE_FRAME_INTERVAL_MS,
  REDUCED_MOTION_FRAME_INTERVAL_MS,
} from '../constants/scene.js';
import { clamp } from './math.js';

export function uiInsetFor(width) {
  if (width <= MOBILE_BREAKPOINT) {
    return 14.4;
  }

  return clamp(width * 0.022, 16, 28.8);
}

export function gearSizeFor(width) {
  return (width <= MOBILE_BREAKPOINT ? 3.7 : 4.45) * 16;
}

export function groupDockSizeFor(width) {
  return (width <= MOBILE_BREAKPOINT ? 3.1 : 3.55) * 16;
}

export function scoreDockSizeFor(width) {
  return (width <= MOBILE_BREAKPOINT ? 3.65 : 4.2) * 16;
}

export function allocationWidgetSizeFor(width) {
  return (width <= MOBILE_BREAKPOINT ? 3.5 : 4) * 16;
}

export function toolTriggerSizeFor(width) {
  return scoreDockSizeFor(width);
}

export function toolDockGapFor(width) {
  return width <= MOBILE_BREAKPOINT ? 12 : 16;
}

export function toolDockStackStepFor(width) {
  return width <= MOBILE_BREAKPOINT ? 68 : 76;
}

export function stackDockBelow(anchorX, anchorY, previousSize, dockSize, width, height, steps = 1) {
  const inset = toolDockGapFor(width);
  const step = toolDockStackStepFor(width) * steps;

  return {
    x: clamp(
      anchorX + (previousSize - dockSize) * 0.5,
      inset,
      width - dockSize - inset,
    ),
    y: clamp(
      anchorY + previousSize * 0.5 + step - dockSize * 0.5,
      inset,
      height - dockSize - inset,
    ),
  };
}

export function stackDockBelowRect(rect, previousSize, dockSize, width, height, steps = 1) {
  const anchorX = rect.left + rect.width * 0.5 - previousSize * 0.5;
  const anchorY = rect.top + rect.height * 0.5 - previousSize * 0.5;
  return stackDockBelow(anchorX, anchorY, previousSize, dockSize, width, height, steps);
}

export function swirlDockSizeFor(width) {
  return (width <= MOBILE_BREAKPOINT ? 3.05 : 3.38) * 16;
}

export function swirlDockYFor(width) {
  return 202 + scoreDockSizeFor(width) + (width <= MOBILE_BREAKPOINT ? 42 : 48);
}

export function heatmapDockSizeFor(width) {
  return (width <= MOBILE_BREAKPOINT ? 3.15 : 3.5) * 16;
}

export function heatmapDockYFor(width) {
  return swirlDockYFor(width) + swirlDockSizeFor(width) + (width <= MOBILE_BREAKPOINT ? 38 : 44);
}

export function floatingPanelSideFor(positionX, dockSize, viewportWidth) {
  if (typeof positionX !== 'number') {
    return 'right';
  }

  const resolvedViewportWidth =
    typeof viewportWidth === 'number'
      ? viewportWidth
      : typeof window !== 'undefined'
        ? window.innerWidth
        : 0;

  if (!resolvedViewportWidth) {
    return 'right';
  }

  return positionX + dockSize * 0.5 >= resolvedViewportWidth * 0.5 ? 'left' : 'right';
}

export function uploadDockCenterOffsetFor(width, anchorWidth = 0) {
  if (anchorWidth > 0) {
    return clamp(
      anchorWidth * 0.26,
      width <= MOBILE_BREAKPOINT ? 70 : 78,
      width <= MOBILE_BREAKPOINT ? 92 : 108,
    );
  }

  return width <= MOBILE_BREAKPOINT ? 78 : 92;
}

export function alignedDockXFor(width, dockSize, anchorWidth = 0) {
  const inset = uiInsetFor(width);
  return inset + (anchorWidth > 0 ? (anchorWidth - dockSize) * 0.5 : 0);
}

export function sceneFrameIntervalFor(atomCount, reducedMotion) {
  if (reducedMotion) {
    return REDUCED_MOTION_FRAME_INTERVAL_MS;
  }

  return atomCount > LARGE_SCENE_ATOM_THRESHOLD
    ? LARGE_SCENE_FRAME_INTERVAL_MS
    : SCENE_FRAME_INTERVAL_MS;
}
