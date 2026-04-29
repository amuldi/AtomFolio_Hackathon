import { useState, useEffect } from 'react';
import { noise } from '../../utils/math.js';
import {
  textFor,
  formatHeatmapValue,
  formatHeatmapDateLabel,
  formatHeatmapMonthLabel,
} from '../../utils/format.js';

export function HeatmapCard({
  heatmap,
  language,
  className = 'heatmap-panel',
  onPointerDown,
}) {
  const latestDataCell = [...heatmap.cells].reverse().find((cell) => cell.hasData) ?? null;
  const [activeKey, setActiveKey] = useState(latestDataCell?.key ?? null);
  const text = textFor(language);

  useEffect(() => {
    setActiveKey((current) =>
      heatmap.cells.some((cell) => cell.key === current && cell.hasData)
        ? current
        : latestDataCell?.key ?? null,
    );
  }, [heatmap, latestDataCell]);

  const activeCell =
    heatmap.cells.find((cell) => cell.key === activeKey && cell.hasData) ?? latestDataCell;
  const dayLabels =
    language === 'en'
      ? [
          { label: 'Mon', row: 1 },
          { label: 'Wed', row: 3 },
          { label: 'Fri', row: 5 },
        ]
      : [
          { label: '월', row: 1 },
          { label: '수', row: 3 },
          { label: '금', row: 5 },
        ];
  const legendSteps = [0.1, 0.28, 0.46, 0.68, 0.92];

  return (
    <aside className={className} onPointerDown={onPointerDown} aria-label={text.heatmapChartAria}>
      {heatmap.entriesCount ? (
        <>
          <div
            className="heatmap-panel__months"
            style={{ gridTemplateColumns: `repeat(${heatmap.weeks}, var(--heat-cell-size))` }}
          >
            {heatmap.monthLabels.map((month) => (
              <span
                key={`month-${month.index}`}
                className="heatmap-panel__month"
                style={{ gridColumnStart: month.index + 1 }}
              >
                {formatHeatmapMonthLabel(month.date, language)}
              </span>
            ))}
          </div>

          <div className="heatmap-panel__body">
            <div className="heatmap-panel__days">
              {dayLabels.map((day) => (
                <span
                  key={day.label}
                  className="heatmap-panel__day"
                  style={{ gridRowStart: day.row }}
                >
                  {day.label}
                </span>
              ))}
            </div>

            <div
              className="heatmap-panel__grid"
              style={{ gridTemplateColumns: `repeat(${heatmap.weeks}, var(--heat-cell-size))` }}
            >
              {heatmap.cells.map((cell, index) => (
                <div
                  key={cell.key}
                  className={`heatmap-panel__cell${cell.positive ? ' is-positive' : ''}${
                    cell.negative ? ' is-negative' : ''
                  }${cell.hasData ? ' has-data' : ''}${cell.key === activeKey ? ' is-active' : ''}`}
                  style={{
                    gridColumnStart: Math.floor(index / 7) + 1,
                    gridRowStart: (index % 7) + 1,
                    '--heat-alpha': cell.positive
                      ? (0.14 + (cell.positiveIntensity ?? cell.intensity) * 0.84).toFixed(3)
                      : 0,
                    '--heat-dark-alpha': cell.negative
                      ? (0.16 + (cell.negativeIntensity ?? cell.intensity) * 0.8).toFixed(3)
                      : 0,
                    borderRadius: `${1 + Math.round(noise(3901 + index * 7) * 2.2)}px`,
                  }}
                  onPointerEnter={() => {
                    if (cell.hasData) {
                      setActiveKey(cell.key);
                    }
                  }}
                />
              ))}
            </div>
          </div>

          <div className="heatmap-panel__footer">
            <div className="heatmap-panel__meta">
              {activeCell ? (
                <>
                  <span>{formatHeatmapDateLabel(activeCell.date, language)}</span>
                  <strong>{formatHeatmapValue(activeCell.value, heatmap.valueMode)}</strong>
                </>
              ) : null}
            </div>

            <div className="heatmap-panel__legend" aria-hidden="true">
              <span className="heatmap-panel__legend-label">{text.heatmapLess}</span>
              <div className="heatmap-panel__legend-scale">
                {legendSteps.map((step, index) => (
                  <span
                    key={`legend-step-${step}`}
                    className={`heatmap-panel__legend-cell${
                      index === 0 ? ' is-negative' : ''
                    }`}
                    style={{
                      '--legend-alpha': step.toFixed(3),
                      '--legend-dark-alpha': (0.28 + step * 0.54).toFixed(3),
                    }}
                  />
                ))}
              </div>
              <span className="heatmap-panel__legend-label">{text.heatmapMore}</span>
            </div>
          </div>
        </>
      ) : (
        <p className="heatmap-panel__empty">{text.heatmapEmpty}</p>
      )}
    </aside>
  );
}
