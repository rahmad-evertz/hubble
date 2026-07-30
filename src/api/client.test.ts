import { describe, expect, it } from 'vitest'
import { nextLink, onRateLimit, pollIntervalSeconds } from './client'

describe('nextLink', () => {
  it('extracts the next URL from a multi-relation Link header', () => {
    const headers = new Headers({
      Link: '<https://api.github.com/resource?page=2>; rel="next", <https://api.github.com/resource?page=9>; rel="last"',
    })
    expect(nextLink(headers)).toBe('https://api.github.com/resource?page=2')
  })

  it('returns null when there is no Link header', () => {
    expect(nextLink(new Headers())).toBeNull()
  })

  it('returns null when no relation is "next"', () => {
    const headers = new Headers({
      Link: '<https://api.github.com/resource?page=1>; rel="first", <https://api.github.com/resource?page=9>; rel="last"',
    })
    expect(nextLink(headers)).toBeNull()
  })
})

describe('pollIntervalSeconds', () => {
  it('parses the advertised poll interval', () => {
    const headers = new Headers({ 'X-Poll-Interval': '90' })
    expect(pollIntervalSeconds(headers, 60)).toBe(90)
  })

  it('falls back when the header is missing', () => {
    expect(pollIntervalSeconds(new Headers(), 60)).toBe(60)
  })

  it('falls back when the header is not a number', () => {
    const headers = new Headers({ 'X-Poll-Interval': 'soon' })
    expect(pollIntervalSeconds(headers, 60)).toBe(60)
  })
})

describe('onRateLimit', () => {
  it('returns an unsubscribe function', () => {
    const unsubscribe = onRateLimit(() => {})
    expect(typeof unsubscribe).toBe('function')
  })

  it('is safe to unsubscribe more than once', () => {
    const unsubscribe = onRateLimit(() => {})
    expect(() => {
      unsubscribe()
      unsubscribe()
    }).not.toThrow()
  })
})
