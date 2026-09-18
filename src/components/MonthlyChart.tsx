import { useState } from 'react'
import {
  columnLidPath,
  columnPath,
  columnSidePath,
  floorPlanePath,
  LID_DY,
  niceScale,
} from '../lib/chart'
import { monthLabel } from '../lib/dates'
import type { MonthBucket } from '../types'

/** viewBox units; the SVG itself scales to its container width. */
const W = 720
const H = 210
const PAD = { top: 18, right: 8, bottom: 24, left: 32 }
/** Bars are capped rather than filling their slot, so each band keeps some air.
 *  BAR_W plus BAR_GAP still sums to the old group width, so band layout and the
 *  hover hit areas are unchanged; the wider gap is what lets the second
 *  column's side face sit clear of the first. */
const BAR_W = 16
const BAR_GAP = 6
const CORNER = 3

const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

type Props = { months: MonthBucket[] }

/**
 * Grouped columns: merged and reviewed are both counts of pull requests, so
 * they share one axis. Two measures on two scales would need two charts, never
 * a second y-axis.
 *
 * Depth is drawn, not transformed. Rotating the plane would keystone the
 * labels, make value comparison harder, and silently decouple the tooltip's
 * position from where a column actually paints.
 */
export default function MonthlyChart({ months }: Props) {
  const [hovered, setHovered] = useState<number | null>(null)

  const peak = Math.max(1, ...months.flatMap((m) => [m.merged, m.reviewedApprox]))
  const { max, ticks } = niceScale(peak)
  const bandW = PLOT_W / Math.max(1, months.length)
  const groupW = BAR_W * 2 + BAR_GAP

  const y = (value: number) => PAD.top + PLOT_H - (value / max) * PLOT_H
  const bandCenter = (i: number) => PAD.left + bandW * (i + 0.5)

  const active = hovered === null ? null : months[hovered]

  return (
    <div className="chart">
      <div className="legend">
        <span className="legend-key">
          <span className="legend-swatch swatch-1" />
          Merged
        </span>
        <span className="legend-key">
          <span className="legend-swatch swatch-2" />
          Reviewed (approximate)
        </span>
      </div>

      {/* The tooltip is positioned as a percentage of this wrapper, which is
          exactly the svg's box. It used to be a percentage of .chart, whose
          height also includes the legend above, so it sat low by the legend's
          height on every reading. */}
      <div className="chart-plot">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Merged and reviewed pull requests by month"
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                className="chart-grid"
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
              />
              <text className="chart-tick" x={PAD.left - 6} y={y(tick) + 3} textAnchor="end">
                {tick}
              </text>
            </g>
          ))}

          {/* The ground plane is what makes a lid read as above rather than
              simply taller. */}
          <path className="chart-floor" d={floorPlanePath(PAD.left, W - PAD.right, y(0))} />
          <line className="chart-axis" x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} />

          <g className="chart-columns">
            {months.map((month, i) => {
              const center = bandCenter(i)
              const left = center - groupW / 2
              const isLast = i === months.length - 1
              const series = [
                { key: 'col-1', value: month.merged, x: left },
                { key: 'col-2', value: month.reviewedApprox, x: left + BAR_W + BAR_GAP },
              ]
              return (
                <g key={month.key}>
                  {/* Hit area spans the whole band so hovering never requires
                      hitting a thin bar, or any bar at all, at zero. */}
                  <rect
                    className="chart-band"
                    x={PAD.left + bandW * i}
                    y={PAD.top}
                    width={bandW}
                    height={PLOT_H}
                    tabIndex={0}
                    role="button"
                    aria-label={`${monthLabel(month.key)} ${month.key.slice(0, 4)}: ${month.merged} merged, ${month.reviewedApprox} reviewed`}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(i)}
                    onBlur={() => setHovered(null)}
                  />
                  {series.map(
                    ({ key, value, x }) =>
                      value > 0 && (
                        // Side, lid, then front: the front face's rounded top
                        // overlays the lid's sharp corners and reads as a lip.
                        <g key={key} className={key}>
                          <path
                            className="col-side"
                            d={columnSidePath(x, y(value), y(0) - y(value))}
                          />
                          <path className="col-lid" d={columnLidPath(x, y(value), BAR_W)} />
                          <path
                            className="col-front"
                            d={columnPath(x, y(value), BAR_W, y(0) - y(value), CORNER)}
                          />
                        </g>
                      ),
                  )}
                  {/* Direct-label only the endpoint month; a number on every
                      column is noise and goes unread. */}
                  {isLast &&
                    series.map(
                      ({ key, value, x }) =>
                        value > 0 && (
                          <text
                            key={`${key}-label`}
                            className="chart-label"
                            x={x + BAR_W / 2}
                            y={y(value) - 5 + LID_DY}
                            textAnchor="middle"
                          >
                            {value}
                          </text>
                        ),
                    )}
                  <text className="chart-tick" x={center} y={H - 8} textAnchor="middle">
                    {monthLabel(month.key)}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>

        {active && (
          <div
            className="chart-tooltip"
            style={{
              left: `${(bandCenter(hovered!) / W) * 100}%`,
              top: `${((y(Math.max(active.merged, active.reviewedApprox)) + LID_DY) / H) * 100}%`,
            }}
          >
            <div className="tt-title">{formatMonth(active.key)}</div>
            <div className="tt-row">
              <span className="legend-swatch swatch-1" />
              merged <b>{active.merged}</b>
            </div>
            <div className="tt-row">
              <span className="legend-swatch swatch-2" />
              reviewed <b>{active.reviewedApprox}</b>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function formatMonth(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
