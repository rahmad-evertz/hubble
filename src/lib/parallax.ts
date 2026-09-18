export type ParallaxPoint = { px: number; py: number }

/** Three places is below the threshold where a change is visible at all. */
const PLACES = 1000

function axis(value: number, size: number): number {
  // Also catches NaN, which a zero-height box would otherwise produce.
  if (!(size > 0)) return 0
  const ratio = (value / size) * 2 - 1
  const clamped = Math.max(-1, Math.min(1, ratio))
  return Math.round(clamped * PLACES) / PLACES
}

/**
 * Maps a pointer position inside a box to -1..1 on each axis, 0 at the centre.
 *
 * Clamped, so a pointer that has left the box cannot push a scene past its
 * intended travel. A zero-sized box reports the centre rather than dividing by
 * zero. Rounded, so a caller can skip a DOM write when nothing visibly changed.
 */
export function parallaxFromPoint(
  x: number,
  y: number,
  width: number,
  height: number,
): ParallaxPoint {
  return { px: axis(x, width), py: axis(y, height) }
}
