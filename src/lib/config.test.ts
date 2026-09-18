import { describe, expect, it } from 'vitest'
import { BLANK_CONFIG, isConfigured } from './config'

describe('isConfigured', () => {
  it('requires both a token and a username', () => {
    expect(isConfigured({ ...BLANK_CONFIG, githubToken: 'ghp_x', username: 'octocat' })).toBe(true)
  })

  it('is not configured with no token', () => {
    expect(isConfigured({ ...BLANK_CONFIG, username: 'octocat' })).toBe(false)
  })

  it('is not configured with no username', () => {
    expect(isConfigured({ ...BLANK_CONFIG, githubToken: 'ghp_x' })).toBe(false)
  })

  it('does not require an org, since a blank org widens the search instead', () => {
    expect(
      isConfigured({ ...BLANK_CONFIG, githubToken: 'ghp_x', username: 'octocat', org: '' }),
    ).toBe(true)
  })

  it('is not configured when both are blank', () => {
    expect(isConfigured(BLANK_CONFIG)).toBe(false)
  })
})
