import type { AppConfig, PrRole, PullRequest, ReviewState } from '../types'
import { ageSeverity, extractTicket, ticketUrl } from './classify'
import { daysSince, relativeAge } from './dates'

export const ROLE_BADGE: Record<PrRole, { label: string; className: string }> = {
  author: { label: 'Authored', className: 'badge-accent' },
  reviewer: { label: 'To review', className: 'badge-warning' },
  assignee: { label: 'Assigned', className: 'badge-purple' },
  mentioned: { label: 'Mentioned', className: 'badge-neutral' },
}

const REVIEW_BADGE: Record<string, { label: string; className: string }> = {
  APPROVED: { label: 'Approved', className: 'badge-success' },
  CHANGES_REQUESTED: { label: 'Changes requested', className: 'badge-danger' },
  REVIEW_REQUIRED: { label: 'Review required', className: 'badge-neutral' },
}

const OWN_REVIEW_LABEL: Partial<Record<ReviewState, string>> = {
  APPROVED: 'you approved',
  CHANGES_REQUESTED: 'you requested changes',
  COMMENTED: 'you commented',
  DISMISSED: 'your review was dismissed',
}

export type PrFacts = {
  /** Short name only: the owner is already the configured org. */
  repoName: string
  authorLabel: string | null
  age: string
  ageClass: string
  activity: string
  ciClass: string
  ciTitle: string
  hasConflict: boolean
  ticket: { key: string; href: string } | null
  review: { label: string; className: string } | null
  ownReview: string | undefined
}

/**
 * Everything both PR views derive from a pull request, in one place so the deck
 * and the table cannot drift apart. Pure, so it is testable under this
 * project's node-environment test setup, which a shared JSX component would
 * not be.
 */
export function prFacts(pr: PullRequest, config: AppConfig, now: Date = new Date()): PrFacts {
  const ticketKey = extractTicket(pr.title, config.ticketPattern)
  return {
    repoName: pr.repo.split('/')[1] ?? pr.repo,
    authorLabel: pr.authorLogin ? `${pr.authorLogin}${pr.authorIsBot ? ' (bot)' : ''}` : null,
    age: relativeAge(pr.createdAt, now),
    ageClass: `age-${ageSeverity(daysSince(pr.createdAt, now))}`,
    activity: relativeAge(pr.updatedAt, now),
    // No rule exists for ci-NONE; it falls through to the base dot on purpose.
    ciClass: `ci-${pr.checkState ?? 'NONE'}`,
    ciTitle: pr.checkState ? `Checks: ${pr.checkState}` : 'No checks reported',
    hasConflict: pr.mergeable === 'CONFLICTING',
    ticket:
      ticketKey && config.ticketBaseUrl
        ? { key: ticketKey, href: ticketUrl(ticketKey, config.ticketBaseUrl) }
        : null,
    review: pr.reviewDecision ? (REVIEW_BADGE[pr.reviewDecision] ?? null) : null,
    ownReview: pr.userLatestReview ? OWN_REVIEW_LABEL[pr.userLatestReview] : undefined,
  }
}
