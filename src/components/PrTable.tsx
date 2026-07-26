import { ageSeverity, extractTicket, ticketUrl } from '../lib/classify'
import { daysSince, relativeAge } from '../lib/dates'
import type { AppConfig, PrRole, PullRequest, ReviewState } from '../types'

const ROLE_BADGE: Record<PrRole, { label: string; className: string }> = {
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

const MAX_AVATARS = 3

type Props = {
  prs: PullRequest[]
  config: AppConfig
  emptyTitle: string
  emptyBody: string
}

export default function PrTable({ prs, config, emptyTitle, emptyBody }: Props) {
  if (prs.length === 0) {
    return (
      <div className="empty">
        <strong>{emptyTitle}</strong>
        {emptyBody}
      </div>
    )
  }

  return (
    <div className="table-scroll">
      <table className="prs">
        <thead>
          <tr>
            <th>Repository</th>
            <th style={{ textAlign: 'right' }}>#</th>
            <th>Title</th>
            <th>You</th>
            <th className="col-optional">Review</th>
            <th title="Status check rollup">CI</th>
            <th className="col-optional">Waiting on</th>
            <th className="col-compact">Age</th>
            <th className="col-compact">Activity</th>
            <th className="col-optional">Size</th>
          </tr>
        </thead>
        <tbody>
          {prs.map((pr) => (
            <Row key={pr.id} pr={pr} config={config} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Row({ pr, config }: { pr: PullRequest; config: AppConfig }) {
  const ageDays = daysSince(pr.createdAt)
  const ticket = extractTicket(pr.title, config.ticketPattern)
  const review = pr.reviewDecision ? REVIEW_BADGE[pr.reviewDecision] : null
  const ownReview = pr.userLatestReview ? OWN_REVIEW_LABEL[pr.userLatestReview] : undefined
  const [, repoName] = pr.repo.split('/')

  return (
    <tr>
      <td className="cell-repo" title={pr.repo}>
        {repoName ?? pr.repo}
      </td>
      <td className="cell-num">{pr.number}</td>
      <td className="cell-title">
        <a className="pr-title" href={pr.url} target="_blank" rel="noreferrer">
          {pr.title}
        </a>
        <div className="pr-sub">
          {pr.isDraft && <span className="badge badge-neutral">Draft</span>}
          {pr.mergeable === 'CONFLICTING' && <span className="badge badge-danger">Conflict</span>}
          {pr.authorLogin && (
            <span>
              {pr.authorLogin}
              {pr.authorIsBot && ' (bot)'}
            </span>
          )}
          {ownReview && <span>{ownReview}</span>}
          {ticket && config.ticketBaseUrl && (
            <a href={ticketUrl(ticket, config.ticketBaseUrl)} target="_blank" rel="noreferrer">
              {ticket}
            </a>
          )}
        </div>
      </td>
      <td>
        <div className="roles">
          {pr.roles.map((role) => (
            <span key={role} className={`badge ${ROLE_BADGE[role].className}`}>
              {ROLE_BADGE[role].label}
            </span>
          ))}
        </div>
      </td>
      <td className="col-optional">
        {review ? (
          <span className={`badge ${review.className}`}>{review.label}</span>
        ) : (
          <span style={{ color: 'var(--fg-subtle)' }}>—</span>
        )}
      </td>
      <td>
        <span
          className={`ci-dot ci-${pr.checkState ?? 'NONE'}`}
          title={pr.checkState ? `Checks: ${pr.checkState}` : 'No checks reported'}
        />
      </td>
      <td className="col-optional">
        {pr.waitingOn.length > 0 ? (
          <span className="avatars">
            {pr.waitingOn.slice(0, MAX_AVATARS).map((r) => (
              <img key={r.login} src={r.avatarUrl} alt={r.login} title={r.login} />
            ))}
            {pr.waitingOn.length > MAX_AVATARS && (
              <span style={{ marginLeft: 4, color: 'var(--fg-subtle)' }}>
                +{pr.waitingOn.length - MAX_AVATARS}
              </span>
            )}
          </span>
        ) : (
          <span style={{ color: 'var(--fg-subtle)' }}>—</span>
        )}
      </td>
      <td className={`col-compact num age-${ageSeverity(ageDays)}`}>{relativeAge(pr.createdAt)}</td>
      <td className="col-compact num" style={{ color: 'var(--fg-muted)' }}>
        {relativeAge(pr.updatedAt)}
      </td>
      <td className="col-optional num" title={`${pr.changedFiles} files changed`}>
        <span className="diff-add">+{pr.additions}</span>{' '}
        <span className="diff-del">−{pr.deletions}</span>
      </td>
    </tr>
  )
}
