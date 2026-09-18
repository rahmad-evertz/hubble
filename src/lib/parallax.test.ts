import { describe, expect, it } from 'vitest'
import { parallaxFromPoint } from './parallax'

describe('parallaxFromPoint', () => {
  it('reports the centre of the box as zero on both axes', () => {
    expect(parallaxFromPoint(500, 250, 1000, 500)).toEqual({ px: 0, py: 0 })
  })

  it('reports each corner at full magnitude with the right signs', () => {
    expect(parallaxFromPoint(0, 0, 1000, 500)).toEqual({ px: -1, py: -1 })
    expect(parallaxFromPoint(1000, 0, 1000, 500)).toEqual({ px: 1, py: -1 })
    expect(parallaxFromPoint(0, 500, 1000, 500)).toEqual({ px: -1, py: 1 })
    expect(parallaxFromPoint(1000, 500, 1000, 500)).toEqual({ px: 1, py: 1 })
  })

  it('scales linearly between the centre and an edge', () => {
    expect(parallaxFromPoint(750, 375, 1000, 500)).toEqual({ px: 0.5, py: 0.5 })
  })

  it('clamps a pointer that has left the box', () => {
    expect(parallaxFromPoint(-400, 900, 1000, 500)).toEqual({ px: -1, py: 1 })
  })

  it('reports the centre for a zero-sized box rather than dividing by zero', () => {
    expect(parallaxFromPoint(10, 10, 0, 0)).toEqual({ px: 0, py: 0 })
  })

  it('reports the centre for a negative or non-finite box', () => {
    expect(parallaxFromPoint(10, 10, -100, Number.NaN)).toEqual({ px: 0, py: 0 })
  })

  it('rounds to three places, so an unchanged value can skip a DOM write', () => {
    const { px } = parallaxFromPoint(500.4321, 0, 1000, 500)
    expect(px).toBe(0.001)
  })
})
