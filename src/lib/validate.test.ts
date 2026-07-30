import { describe, expect, it } from 'vitest'
import { assertValidLogin, isValidLogin, looksLikeToken } from './validate'

describe('isValidLogin', () => {
  it('accepts a plain alphanumeric login', () => {
    expect(isValidLogin('octocat')).toBe(true)
  })

  it('accepts single hyphens between alphanumerics', () => {
    expect(isValidLogin('octo-cat')).toBe(true)
  })

  it.each([
    '',
    'has space',
    'no:colons',
    'trailing-',
    '-leading',
    'double--hyphen',
    'a'.repeat(40),
  ])('rejects %j', (bad) => {
    expect(isValidLogin(bad)).toBe(false)
  })

  it('accepts the 39-character maximum', () => {
    expect(isValidLogin('a'.repeat(39))).toBe(true)
  })
})

describe('assertValidLogin', () => {
  it('returns the value unchanged when valid', () => {
    expect(assertValidLogin('octocat', 'Username')).toBe('octocat')
  })

  it('throws with the label and value in the message when invalid', () => {
    expect(() => assertValidLogin('bad name', 'Username')).toThrow(/Username "bad name"/)
  })
})

describe('looksLikeToken', () => {
  it('accepts a classic PAT shape', () => {
    expect(looksLikeToken(`ghp_${'a'.repeat(36)}`)).toBe(true)
  })

  it('accepts a 40-char hex token', () => {
    expect(looksLikeToken('a'.repeat(40))).toBe(true)
  })

  it('rejects anything under 20 characters', () => {
    expect(looksLikeToken('short')).toBe(false)
  })

  it('rejects a value containing whitespace', () => {
    expect(looksLikeToken('a'.repeat(15) + ' ' + 'a'.repeat(15))).toBe(false)
  })

  it('ignores surrounding whitespace when checking length', () => {
    expect(looksLikeToken(`  ${'a'.repeat(20)}  `)).toBe(true)
  })
})
