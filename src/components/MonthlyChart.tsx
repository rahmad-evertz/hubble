import { useState } from 'react'
import { monthLabel } from '../lib/dates'
import type { MonthBucket } from '../types'

/** viewBox units; the SVG itself scales to its container width. */
const W = 720
const H = 210
const PAD = { top: 14, right: 8, bottom: 24, left: 32 }
/** Bars are capped rather than filling their slot, so each band keeps some air. */
const BAR_W = 18
const BAR_GAP = 2
const CORNER = 4

const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

type Props = { months: MonthBucket[] }

/**
 * Grouped columns: merged and reviewed are both counts of pull requests, so they
 * share one axis. Two measures on two scales would need two charts, never a
 * second y-axis.
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
          <span className="legend-swatch" style={{ background: 'var(--series-1)' }} />
          Merged
        </span>
        <span className="legend-key">
          <span className="legend-swatch" style={{ background: 'var(--series-2)' }} />
          Reviewed (approximate)
        </span>
      </div>

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

        <line className="chart-axis" x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} />

        {months.map((month, i) => {
          const center = bandCenter(i)
          const left = center - groupW / 2
          const isLast = i === months.length - 1
          return (
            <g key={month.key}>
              {/* Hit area spans the whole band so hovering never requires
                  hitting a thin bar — or any bar at all, at zero. */}
              <rect
                className="chart-band"
                x={PAD.left + bandW * i}
                y={PAD.top}
                width={bandW}
                height={PLOT_H}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
              {month.merged > 0 && (
                <path
                  d={columnPath(left, y(month.merged), BAR_W, y(0) - y(month.merged))}
                  fill="var(--series-1)"
                />
              )}
              {month.reviewedApprox > 0 && (
                <path
                  d={columnPath(
                    left + BAR_W + BAR_GAP,
                    y(month.reviewedApprox),
                    BAR_W,
                    y(0) - y(month.reviewedApprox),
                  )}
                  fill="var(--series-2)"
                />
              )}
              {/* Direct-label only the endpoint month; a number on every column
                  is noise and goes unread. */}
              {isLast && month.merged > 0 && (
                <text
                  className="chart-label"
                  x={left + BAR_W / 2}
                  y={y(month.merged) - 5}
                  textAnchor="middle"
                >
                  {month.merged}
                </text>
              )}
              {isLast && month.reviewedApprox > 0 && (
                <text
                  className="chart-label"
                  x={left + BAR_W * 1.5 + BAR_GAP}
                  y={y(month.reviewedApprox) - 5}
                  textAnchor="middle"
                >
                  {month.reviewedApprox}
                </text>
              )}
              <text className="chart-tick" x={center} y={H - 8} textAnchor="middle">
                {monthLabel(month.key)}
              </text>
            </g>
          )
        })}
      </svg>

      {active && (
        <div
          className="chart-tooltip"
          style={{
            left: `${(bandCenter(hovered!) / W) * 100}%`,
            top: `${(y(Math.max(active.merged, active.reviewedApprox)) / H) * 100}%`,
          }}
        >
          <div className="tt-title">{formatMonth(active.key)}</div>
          <div className="tt-row">
            <span className="legend-swatch" style={{ background: 'var(--series-1)' }} />
            merged <b>{active.merged}</b>
          </div>
          <div className="tt-row">
            <span className="legend-swatch" style={{ background: 'var(--series-2)' }} />
            reviewed <b>{active.reviewedApprox}</b>
          </div>
        </div>
      )}
    </div>
  )
}

/** Rounded at the data end, square at the baseline. */
function columnPath(x: number, top: number, width: number, height: number): string {
  const r = Math.min(CORNER, width / 2, height)
  const bottom = top + height
  return [
    `M${x},${bottom}`,
    `L${x},${top + r}`,
    `Q${x},${top} ${x + r},${top}`,
    `L${x + width - r},${top}`,
    `Q${x + width},${top} ${x + width},${top + r}`,
    `L${x + width},${bottom}`,
    'Z',
  ].join(' ')
}

function formatMonth(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** Axis ticks land on clean numbers rather than the raw data maximum. */
function niceScale(peak: number, targetTicks = 5): { max: number; ticks: number[] } {
  const rawStep = peak / targetTicks
  const magnitude = 10 ** Math.floor(Math.log10(rawStep || 1))
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep) ?? 10 * magnitude
  const max = Math.max(step, Math.ceil(peak / step) * step)
  const ticks: number[] = []
  for (let tick = 0; tick <= max + 1e-9; tick += step) ticks.push(Math.round(tick * 100) / 100)
  return { max, ticks }
}
