import { useMemo, useState } from 'react'
import { ageSeverity, extractTicket, ticketUrl } from '../lib/classify'
import { daysSince, relativeAge } from '../lib/dates'
import { groupByRepo, sortPrs, type RepoGroup, type SortKey } from '../lib/sortPrs'
import * as storage from '../lib/storage'
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
/** Repository, #, Title, You, Review, CI, Conflict, Waiting on, Age, Activity, Size. */
const COLUMN_COUNT = 11

type Props = {
  prs: PullRequest[]
  config: AppConfig
  emptyTitle: string
  emptyBody: string
  onOpen?: (pr: PullRequest) => void
}

export default function PrTable({ prs, config, emptyTitle, emptyBody, onOpen }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>(() => storage.read<SortKey>('prSort', 'activity'))
  const [grouped, setGrouped] = useState(() => storage.read('prGroupByRepo', false))
  const [collapsedRepos, setCollapsedRepos] = useState<Record<string, boolean>>({})

  const sorted = useMemo(() => sortPrs(prs, sortKey), [prs, sortKey])
  const groups = useMemo(() => (grouped ? groupByRepo(sorted) : null), [grouped, sorted])

  if (prs.length === 0) {
    return (
      <div className="empty">
        <strong>{emptyTitle}</strong>
        {emptyBody}
      </div>
    )
  }

  function updateSort(key: SortKey) {
    storage.write('prSort', key)
    setSortKey(key)
  }

  function toggleGrouped() {
    const next = !grouped
    storage.write('prGroupByRepo', next)
    setGrouped(next)
  }

  return (
    <div>
      <div className="pr-table-toolbar">
        <div className="sort-control" role="group" aria-label="Sort by">
          <button
            className={`btn btn-sm ${sortKey === 'activity' ? 'btn-primary' : ''}`}
            onClick={() => updateSort('activity')}
          >
            Activity
          </button>
          <button
            className={`btn btn-sm ${sortKey === 'age' ? 'btn-primary' : ''}`}
            onClick={() => updateSort('age')}
          >
            Age
          </button>
        </div>
        <button className="btn btn-sm" onClick={toggleGrouped}>
          {grouped ? 'Ungroup' : 'Group by repo'}
        </button>
      </div>

      <div className="table-scroll">
        <table className="prs">
          <thead>
            <tr>
              {!grouped && <th>Repository</th>}
              <th style={{ textAlign: 'right' }}>#</th>
              <th>Title</th>
              <th>You</th>
              <th className="col-optional">Review</th>
              <th title="Status check rollup">CI</th>
              <th title="Merge conflicts">Conflict</th>
              <th className="col-optional">Waiting on</th>
              <th className="col-compact">Age</th>
              <th className="col-compact">Activity</th>
              <th className="col-optional">Size</th>
            </tr>
          </thead>
          <tbody>
            {groups
              ? groups.map((group) => (
                  <RepoGroupRows
                    key={group.repo}
                    group={group}
                    collapsed={collapsedRepos[group.repo] ?? false}
                    onToggle={() =>
                      setCollapsedRepos((prev) => ({ ...prev, [group.repo]: !prev[group.repo] }))
                    }
                    config={config}
                    onOpen={onOpen}
                  />
                ))
              : sorted.map((pr) => (
                  <Row key={pr.id} pr={pr} config={config} onOpen={onOpen} showRepo />
                ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RepoGroupRows({
  group,
  collapsed,
  onToggle,
  config,
  onOpen,
}: {
  group: RepoGroup
  collapsed: boolean
  onToggle: () => void
  config: AppConfig
  onOpen?: (pr: PullRequest) => void
}) {
  const [, repoName] = group.repo.split('/')

  return (
    <>
      <tr className="repo-group-row">
        <td colSpan={COLUMN_COUNT - 1}>
          <button className="repo-group-head" aria-expanded={!collapsed} onClick={onToggle}>
            <span className="chevron">{collapsed ? '▸' : '▾'}</span>
            {repoName ?? group.repo}
            <span className="tab-count">{group.prs.length}</span>
          </button>
        </td>
      </tr>
      {!collapsed &&
        group.prs.map((pr) => (
          <Row key={pr.id} pr={pr} config={config} onOpen={onOpen} showRepo={false} />
        ))}
    </>
  )
}

function Row({
  pr,
  config,
  onOpen,
  showRepo,
}: {
  pr: PullRequest
  config: AppConfig
  onOpen?: (pr: PullRequest) => void
  showRepo: boolean
}) {
  const ageDays = daysSince(pr.createdAt)
  const ticket = extractTicket(pr.title, config.ticketPattern)
  const review = pr.reviewDecision ? REVIEW_BADGE[pr.reviewDecision] : null
  const ownReview = pr.userLatestReview ? OWN_REVIEW_LABEL[pr.userLatestReview] : undefined
  const [, repoName] = pr.repo.split('/')
  const hasConflict = pr.mergeable === 'CONFLICTING'

  return (
    <tr
      onClick={() => onOpen?.(pr)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen?.(pr)
        }
      }}
      tabIndex={0}
      role="button"
      style={{ cursor: onOpen ? 'pointer' : 'default' }}
    >
      {showRepo && (
        <td className="cell-repo" title={pr.repo}>
          {repoName ?? pr.repo}
        </td>
      )}
      <td className="cell-num">{pr.number}</td>
      <td className="cell-title">
        <a
          className="pr-title"
          href={pr.url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          {pr.title}
        </a>
        <div className="pr-sub">
          {pr.isDraft && <span className="badge badge-neutral">Draft</span>}
          {pr.authorLogin && (
            <span>
              {pr.authorLogin}
              {pr.authorIsBot && ' (bot)'}
            </span>
          )}
          {ownReview && <span>{ownReview}</span>}
          {ticket && config.ticketBaseUrl && (
            <a
              href={ticketUrl(ticket, config.ticketBaseUrl)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
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
      <td>
        <span
          className={`conflict-dot ${hasConflict ? 'has-conflict' : ''}`}
          title={hasConflict ? 'Has merge conflicts' : 'No conflicts detected'}
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
