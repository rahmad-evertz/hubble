import { describe, expect, it } from 'vitest'
import { ageSeverity, extractTicket, ticketUrl } from './classify'

describe('extractTicket', () => {
  it('returns null when no pattern is configured', () => {
    expect(extractTicket('fix PROJ-123: broken build', '')).toBeNull()
  })

  it('extracts the first capture group when the pattern has one', () => {
    expect(extractTicket('fix PROJ-123: broken build', '([A-Z]{2,}-\\d+)')).toBe('PROJ-123')
  })

  it('falls back to the whole match when the pattern has no capture group', () => {
    expect(extractTicket('fix PROJ-123: broken build', 'PROJ-\\d+')).toBe('PROJ-123')
  })

  it('returns null when the pattern does not match', () => {
    expect(extractTicket('no ticket here', '([A-Z]{2,}-\\d+)')).toBeNull()
  })

  it('treats an invalid regex as "no link" rather than throwing', () => {
    // A user-supplied pattern can be malformed mid-typing in Settings.
    expect(extractTicket('PROJ-123', '(unterminated')).toBeNull()
  })
})

describe('ticketUrl', () => {
  it('joins the base URL and key with a single slash', () => {
    expect(ticketUrl('PROJ-123', 'https://issues.example.com')).toBe(
      'https://issues.example.com/PROJ-123',
    )
  })

  it('strips trailing slashes from the base URL before joining', () => {
    expect(ticketUrl('PROJ-123', 'https://issues.example.com/')).toBe(
      'https://issues.example.com/PROJ-123',
    )
    expect(ticketUrl('PROJ-123', 'https://issues.example.com///')).toBe(
      'https://issues.example.com/PROJ-123',
    )
  })
})

describe('ageSeverity', () => {
  it('is fresh at and below a week', () => {
    expect(ageSeverity(0)).toBe('fresh')
    expect(ageSeverity(7)).toBe('fresh')
  })

  it('is aging between one and three weeks', () => {
    expect(ageSeverity(8)).toBe('aging')
    expect(ageSeverity(21)).toBe('aging')
  })

  it('is stale beyond three weeks', () => {
    expect(ageSeverity(22)).toBe('stale')
  })
})
