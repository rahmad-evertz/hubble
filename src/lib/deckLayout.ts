import type { PullRequest } from '../types'
import { ageSeverity } from './classify'
import { daysSince } from './dates'

/**
 * How much of a slot an urgent card may claim. Strictly below 1 on purpose, so
 * depth stays monotonic: the visual stack can then never disagree with DOM
 * order, which is what keeps tab traversal and screen-reader order honest.
 */
const URGENCY_PULL = 0.45

export type PrView = 'deck' | 'table'

export type DeckCard = {
  id: string
  /** 0 is nearest. In slots, not pixels: CSS owns the pixel scale. */
  depth: number
  /** 0 to 1. Drives the rim tint and the opacity floor, never the ordering. */
  urgency: number
}

/**
 * Signals that mean a person has to act. Weighted rather than counted, so one
 * red flag already reads as urgent, and reusing ageSeverity keeps the "a week"
 * and "three weeks" thresholds defined in exactly one place.
 */
export function urgencyScore(pr: PullRequest, now: Date = new Date()): number {
  let score = 0
  // ERROR and FAILURE share the danger colour in the CI dot, so they score alike.
  if (pr.checkState === 'FAILURE' || pr.checkState === 'ERROR') score += 0.3
  if (pr.mergeable === 'CONFLICTING') score += 0.3
  if (pr.reviewDecision === 'CHANGES_REQUESTED') score += 0.25
  // A review request is a claim on your time only until you have answered it.
  if (pr.roles.includes('reviewer') && pr.userLatestReview === null) score += 0.2
  const severity = ageSeverity(daysSince(pr.createdAt, now))
  if (severity === 'aging') score += 0.1
  if (severity === 'stale') score += 0.25
  // A draft is not asking anyone for anything yet, so it should not shout.
  if (pr.isDraft) score *= 0.4
  return Math.min(1, score)
}

/**
 * Per-card depth for an already-sorted list, in input order, so a caller can
 * zip the result against the list it passed in.
 *
 * Depth follows list position rather than urgency, so the deck's near-to-far
 * axis always means whatever the active sort means. Rounded because the value
 * lands in an inline style, and an unrounded float would rewrite the style
 * attribute on every render for no visible difference.
 */
export function deckLayout(prs: PullRequest[], now: Date = new Date()): DeckCard[] {
  return prs.map((pr, index) => {
    const urgency = urgencyScore(pr, now)
    const depth = index + (1 - urgency) * URGENCY_PULL
    return { id: pr.id, depth: Math.round(depth * 1000) / 1000, urgency }
  })
}
