/**
 * Chart geometry, in viewBox units. Extracted from the component so it can be
 * unit-tested: the project's test setup has no DOM, so anything left inside a
 * component is untestable by construction.
 */

/** The lid recedes up and to the left. BAR_GAP is sized to clear it. */
export const LID_DX = -4
export const LID_DY = -3

/** Rounded at the data end, square at the baseline. */
export function columnPath(
  x: number,
  top: number,
  width: number,
  height: number,
  corner: number,
): string {
  const r = Math.min(corner, width / 2, height)
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

/** The top face, as a parallelogram offset from the column's top edge. */
export function columnLidPath(x: number, top: number, width: number): string {
  return [
    `M${x},${top}`,
    `L${x + LID_DX},${top + LID_DY}`,
    `L${x + width + LID_DX},${top + LID_DY}`,
    `L${x + width},${top}`,
    'Z',
  ].join(' ')
}

/** The left face, from the column's top-left edge down to the baseline. */
export function columnSidePath(x: number, top: number, height: number): string {
  const bottom = top + height
  return [
    `M${x},${top}`,
    `L${x + LID_DX},${top + LID_DY}`,
    `L${x + LID_DX},${bottom + LID_DY}`,
    `L${x},${bottom}`,
    'Z',
  ].join(' ')
}

/** The ground plane the columns stand on, so the lid reads as above rather
 *  than simply taller. */
export function floorPlanePath(left: number, right: number, baseline: number): string {
  return [
    `M${left},${baseline}`,
    `L${left + LID_DX},${baseline + LID_DY}`,
    `L${right + LID_DX},${baseline + LID_DY}`,
    `L${right},${baseline}`,
    'Z',
  ].join(' ')
}

/** Axis ticks land on clean numbers rather than the raw data maximum. */
export function niceScale(peak: number, targetTicks = 5): { max: number; ticks: number[] } {
  const rawStep = peak / targetTicks
  const magnitude = 10 ** Math.floor(Math.log10(rawStep || 1))
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep) ?? 10 * magnitude
  const max = Math.max(step, Math.ceil(peak / step) * step)
  const ticks: number[] = []
  for (let tick = 0; tick <= max + 1e-9; tick += step) ticks.push(Math.round(tick * 100) / 100)
  return { max, ticks }
}
