import { describe, expect, it } from 'vitest'
import {
  columnLidPath,
  columnPath,
  columnSidePath,
  floorPlanePath,
  LID_DX,
  LID_DY,
  niceScale,
} from './chart'

describe('niceScale', () => {
  it('rounds the axis up to a clean step rather than the raw peak', () => {
    // Peak 7 gives a step of 2, so the axis tops out at 8 with ticks 0..8.
    expect(niceScale(7).max).toBe(8)
    expect(niceScale(23).max).toBe(25)
  })

  it('always includes zero and the maximum', () => {
    const { max, ticks } = niceScale(23)
    expect(ticks[0]).toBe(0)
    expect(ticks[ticks.length - 1]).toBe(max)
  })

  it('never returns a zero-height axis for an all-zero series', () => {
    expect(niceScale(0).max).toBeGreaterThan(0)
  })

  it('keeps ticks evenly spaced', () => {
    const { ticks } = niceScale(100)
    const steps = ticks.slice(1).map((t, i) => t - ticks[i])
    expect(new Set(steps).size).toBe(1)
  })
})

describe('columnPath', () => {
  it('closes the path and starts at the baseline', () => {
    const d = columnPath(10, 20, 16, 80, 3)
    expect(d.startsWith('M10,100')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
  })

  it('clamps the corner radius so a short column cannot invert', () => {
    const d = columnPath(0, 0, 16, 1, 3)
    expect(d).not.toContain('NaN')
    expect(d).toContain('Q0,0 1,0')
  })
})

describe('columnLidPath', () => {
  it('offsets the top face by the lid vector', () => {
    const d = columnLidPath(10, 20, 16)
    expect(d).toContain(`M10,20`)
    expect(d).toContain(`L${10 + LID_DX},${20 + LID_DY}`)
    expect(d.endsWith('Z')).toBe(true)
  })
})

describe('columnSidePath', () => {
  it('runs from the top edge down to the baseline', () => {
    const d = columnSidePath(10, 20, 80)
    expect(d).toContain('M10,20')
    expect(d).toContain('L10,100')
    expect(d.endsWith('Z')).toBe(true)
  })
})

describe('floorPlanePath', () => {
  it('spans the plot and recedes by the lid vector', () => {
    const d = floorPlanePath(32, 712, 186)
    expect(d).toContain('M32,186')
    expect(d).toContain(`L${712 + LID_DX},${186 + LID_DY}`)
    expect(d.endsWith('Z')).toBe(true)
  })
})
