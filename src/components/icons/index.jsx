import { buildScoreSketchPolygon, buildScoreAxisPath } from '../../utils/scene.js';

export function SketchGearIcon() {
  return (
    <svg className="settings-gear__icon" viewBox="0 0 48 48" aria-hidden="true">
      <path
        className="settings-gear__outline-soft"
        d="M24.2 7.1l3.2.9 1.4 4.5 4.4-.1 2.3 3-1.8 4.2 3.5 2.4-.8 4-4 1.4-.5 4.2-3.5 2.2-3.7-2.1-3.9 2.3-3.2-2.4.2-4.2-4-1.6-.8-3.7 3.1-2.9-1.8-4.1 2.7-3.2 4.3.2 1.5-4.6z"
      />
      <path
        className="settings-gear__outline-main"
        d="M24.4 6.4l3.5 1 1.3 4.6 4.3.1 2.5 3.1-1.9 4 3.2 2.6-.6 4.1-4.2 1.2-.4 4.3-3.6 2.4-3.6-2.2-4 2.3-3.1-2.7.2-4.1-4.2-1.5-.6-3.8 3.2-2.8-2-4 2.6-3.3 4.4.3 1.4-4.6z"
      />
      <path
        className="settings-gear__center-soft"
        d="M24.3 16.8c4.3-.1 7.1 3.1 7 7.2 0 4.1-2.9 7.1-7 7-3.9 0-6.9-2.9-6.9-7 .1-4.1 3-7.2 6.9-7.2z"
      />
      <path
        className="settings-gear__center-main"
        d="M24.2 17.6c3.8 0 6.2 2.9 6.2 6.5 0 3.7-2.4 6.4-6.1 6.4-3.6 0-6.2-2.6-6.2-6.4s2.5-6.5 6.1-6.5z"
      />
    </svg>
  );
}

export function SketchPlusIcon() {
  return (
    <svg className="tool-plus__icon" viewBox="0 0 48 48" aria-hidden="true">
      <path
        className="tool-plus__stroke-soft"
        d="M22.7 8.8L28.5 9.2L28.1 20.3L39 20.7L38.6 27.9L27.7 27.5L27.4 39.1L20.8 38.7L21.2 27.2L9.7 27.4L9.2 20.9L21.7 20.6L22.7 8.8Z"
      />
      <path
        className="tool-plus__stroke-main"
        d="M23.6 8.1L28 8.4L27.8 21.2L39.2 21.3L38.9 26.8L27.4 27L27.1 39.8L21.2 39.3L21.7 26.6L8.8 26.9L8.5 21.6L22.1 21.3L23.6 8.1Z"
      />
      <path
        className="tool-plus__stroke-soft"
        d="M22.5 8.9L28.3 9.4L27.9 20.9L39.1 20.6L38.8 27.4L27.6 27.6L27.2 39.2L20.7 38.8L21 27.3L9.5 27.6L9.1 20.8L21.9 20.8L22.5 8.9Z"
      />
    </svg>
  );
}

export function SketchUploadArrowIcon() {
  return (
    <svg className="upload-arrow__icon" viewBox="0 0 48 48" aria-hidden="true">
      <path
        className="upload-arrow__stroke-soft"
        d="M23.1 7.8L30.1 15.6L27.2 15.1L27.4 28.9L21.2 28.6L21.4 15.4L18 15.7L23.1 7.8Z"
      />
      <path
        className="upload-arrow__stroke-main"
        d="M23.7 7.1L29.7 14.6L26.6 14.2L26.7 30.3L21.7 30L21.8 14.6L18.2 15L23.7 7.1Z"
      />
      <path
        className="upload-arrow__stroke-soft"
        d="M12 31.4L15.7 35.2L31.8 35.4L35.6 31.7"
      />
      <path
        className="upload-arrow__stroke-main"
        d="M12.8 30.6L15.9 33.9L31.4 34L34.9 30.8"
      />
    </svg>
  );
}

export function SketchBurstIcon() {
  return (
    <svg className="group-dock__burst-icon" viewBox="0 0 48 48" aria-hidden="true">
      <path
        className="group-dock__burst-soft"
        d="M24.2 7.4L26.6 15.9L33.2 10.8L31.3 19.4L39.8 17.6L34.5 24.5L42.8 26.7L35.3 30.3L40.4 37.2L31.7 35.4L30.1 43.9L24.3 38.2L18.4 43.8L17.1 35.2L8.4 37.2L13.7 30.2L6.2 26.6L14.6 24.4L9.5 17.5L18 19.4L16.2 10.8L22.8 16Z"
      />
      <path
        className="group-dock__burst-main"
        d="M24.4 8.2L26.4 16.4L33.7 11.4L31.4 20.2L39.6 17.9L34.4 24.3L42.3 26.8L34.8 30.2L39.5 37.2L31.4 35.2L29.5 43.4L24.2 37.7L18.4 43.2L17.2 34.8L8.8 37.2L14.1 29.8L6.8 26.2L14.8 24.2L10.2 17.2L18.4 19.4L16.2 11.2L22.6 16.2Z"
      />
      <path
        className="group-dock__burst-core"
        d="M24.3 14.4L25.8 19.8L30.8 16.4L29.3 22L35 20.8L31.4 25.2L36.8 27.1L31.6 29.4L35 33.8L29.2 32.4L28.2 38.2L24.2 34.2L20.1 38.2L19.3 32.2L13.4 33.6L17 29.2L11.8 27.1L17.2 25.2L13.7 20.6L19.3 21.8L18 16.2L22.8 19.8Z"
      />
    </svg>
  );
}

export function SketchRadarIcon({ scorecard, axes }) {
  const center = 24;
  const radius = 14.5;
  const angleStep = (Math.PI * 2) / axes.length;
  const ringRatios = [0.5, 1];
  const axisPoints = axes.map((axis, index) => {
    const angle = -Math.PI / 2 + index * angleStep;
    return {
      key: axis.key,
      angle,
      outerX: center + Math.cos(angle) * radius,
      outerY: center + Math.sin(angle) * radius,
      value: scorecard.metrics[axis.key],
    };
  });
  const radarPoints = axisPoints.map((axis) => {
    const scaledRadius = radius * (axis.value / 100);
    return {
      x: center + Math.cos(axis.angle) * scaledRadius,
      y: center + Math.sin(axis.angle) * scaledRadius,
    };
  });
  const ringPaths = ringRatios.map((ring, index) => {
    const points = axisPoints.map((axis) => ({
      x: center + Math.cos(axis.angle) * radius * ring,
      y: center + Math.sin(axis.angle) * radius * ring,
    }));

    return {
      key: `mini-ring-${ring}`,
      soft: buildScoreSketchPolygon(points, 3001 + index * 37, 0.58 + index * 0.12),
      main: buildScoreSketchPolygon(points, 3061 + index * 37, 0.42 + index * 0.08),
    };
  });
  const axisSketches = axisPoints.map((axis, index) => ({
    key: axis.key,
    soft: buildScoreAxisPath(
      { x: center, y: center },
      { x: axis.outerX, y: axis.outerY },
      3121 + index * 19,
    ),
    main: buildScoreAxisPath(
      { x: center, y: center },
      { x: axis.outerX, y: axis.outerY },
      3181 + index * 19,
    ),
  }));

  return (
    <svg className="score-dock__icon" viewBox="0 0 48 48" aria-hidden="true">
      {ringPaths.map((ring) => (
        <g key={ring.key}>
          <path d={ring.soft} className="score-dock__icon-grid-soft" />
          <path d={ring.main} className="score-dock__icon-grid-main" />
        </g>
      ))}

      {axisSketches.map((axis) => (
        <g key={axis.key}>
          <path d={axis.soft} className="score-dock__icon-grid-soft" />
          <path d={axis.main} className="score-dock__icon-grid-main" />
        </g>
      ))}

      <path
        d={buildScoreSketchPolygon(radarPoints, 3241, 0.84)}
        className="score-dock__icon-shape-soft"
      />
      <path
        d={buildScoreSketchPolygon(radarPoints, 3301, 0.52)}
        className="score-dock__icon-shape-main"
      />
    </svg>
  );
}

export function SketchSpiralIcon() {
  return (
    <svg className="spiral-glyph__icon" viewBox="0 0 48 48" aria-hidden="true">
      <path
        className="spiral-glyph__soft"
        d="M34.6 11.3C29.4 6.9 19.5 7.2 14.5 12.5C9.9 17.3 9.6 25.6 14 30.7C18.4 35.9 26.7 36.7 31.9 33.1C36.1 30.2 37.9 24.7 36 20.1C34.2 15.9 29.6 13.3 25.2 14.1C21.1 14.8 17.9 18.3 17.9 22.4C17.9 26 20.6 29.1 24.1 29.4C27.2 29.6 29.9 27.5 30.2 24.8C30.4 22.5 29.1 20.6 26.9 19.9"
      />
      <path
        className="spiral-glyph__main"
        d="M33.3 11.2C28.8 7.5 20.1 7.5 15.1 12.1C10.2 16.6 9.9 24.8 14 30.1C18.1 35.4 26.4 36.3 31.3 32.8C35.4 29.8 37.1 24.5 35.3 20.3C33.7 16.4 29.4 14.2 25.4 14.8C21.6 15.3 18.5 18.5 18.4 22.2C18.3 25.8 20.9 28.7 24.1 28.9C27 29.1 29.5 27.1 29.8 24.6C30 22.2 28.8 20.2 26.3 19.4C24.2 18.8 21.8 19.7 20.8 21.6C19.9 23.4 20.3 25.7 21.9 27C23.3 28.1 25.5 28.1 26.9 27"
      />
      <path
        className="spiral-glyph__highlight"
        d="M33.1 11.8C28.5 8.1 20.3 8 15.8 12.5C11.5 16.9 11.2 24.6 14.8 29.3C18.5 34.1 25.9 35 30.6 31.9C34.4 29.4 35.9 24.7 34.4 20.7C33 17.1 29.1 15.1 25.6 15.6C22.3 16 19.6 18.8 19.4 22C19.2 25 21.3 27.5 24.1 27.9C26.7 28.1 28.7 26.4 28.9 24.3C29.1 22.4 28 20.8 26 20.1"
      />
    </svg>
  );
}

export function SketchHeatmapIcon({ heatmap }) {
  const cells = heatmap.cells ?? [];
  const positiveCells = cells.filter((cell) => cell.positive);
  const negativeCells = cells.filter((cell) => cell.negative);
  const positiveGlow = positiveCells.length
    ? positiveCells.reduce(
        (sum, cell) => sum + (cell.positiveIntensity ?? cell.intensity ?? 0.36),
        0,
      ) / positiveCells.length
    : 0.22;
  const negativeWeight = negativeCells.length
    ? negativeCells.reduce(
        (sum, cell) => sum + (cell.negativeIntensity ?? cell.intensity ?? 0.22),
        0,
      ) / negativeCells.length
    : 0.1;
  const lineOpacity = Math.min(0.96, 0.52 + positiveGlow * 0.34 - negativeWeight * 0.08);
  const softOpacity = Math.min(0.7, 0.2 + positiveGlow * 0.28);
  const bladeShapes = [
    {
      key: 'left-short',
      soft: 'M11.4 39.6C11.1 33.2 11.8 28.2 15.4 22.4C18.8 24.4 21.5 29.2 23.6 35.7',
      main: 'M12.2 39.1C12.1 33.5 12.8 29 15.8 23.9C18.6 26.1 20.8 30 22.8 35.2',
    },
    {
      key: 'left-tall',
      soft: 'M17.4 36.6C16.8 27.1 17.8 19.4 21.1 8.2C24.4 12.2 26.2 19.8 27 35.4',
      main: 'M18.2 35.9C17.8 27.5 18.7 20.6 21.6 10C24.1 13.8 25.5 20.7 26.1 34.7',
    },
    {
      key: 'right-tall',
      soft: 'M26.4 35.5C27.3 27.4 29.1 21.1 34.8 15.6C36.6 20 36.6 27.2 33.9 35.7',
      main: 'M27 34.8C28 27.7 29.9 22.4 34.3 17.2C35.6 21.3 35.5 27.5 33.2 35.1',
    },
    {
      key: 'right-short',
      soft: 'M31.8 39.7C32.1 35.1 33.6 31.8 38.8 28.1C40.2 30.4 39.4 34.8 35.9 39.3',
      main: 'M32.4 39.1C32.8 35.2 34.1 32.4 38.1 29.5C39.1 31.7 38.5 35.2 35.6 38.8',
    },
  ];
  const baseCurves = {
    soft: 'M12.5 39.7L17.2 35.8L23.7 35.8L26.1 33.7L28.9 35.8L34.7 35.9L39 32.8L37.2 37.8L36.4 41.1L19.4 41.1L13.7 41Z',
    main: 'M13.4 39.4L17.8 36.4L23.9 36.4L26.2 34.5L28.7 36.4L34.3 36.4L38 33.8L36.3 38.1L35.6 40.3L19.7 40.4L14.5 40.4Z',
  };

  return (
    <svg className="heatmap-dock__icon" viewBox="0 0 48 48" aria-hidden="true">
      {bladeShapes.map((blade, index) => (
        <g key={blade.key}>
          <path
            d={blade.soft}
            className="heatmap-dock__grass-blade-soft"
            opacity={softOpacity - index * 0.022}
          />
          <path
            d={blade.main}
            className="heatmap-dock__grass-blade-main"
            opacity={lineOpacity - index * 0.014}
          />
        </g>
      ))}
      <path d={baseCurves.soft} className="heatmap-dock__grass-blade-soft" opacity={softOpacity * 0.92} />
      <path d={baseCurves.main} className="heatmap-dock__grass-blade-main" opacity={lineOpacity * 0.94} />
    </svg>
  );
}
