import { prFacts, ROLE_BADGE } from '../lib/prFacts'
import type { RepoGroup } from '../lib/sortPrs'
import type { AppConfig, PullRequest } from '../types'

const MAX_AVATARS = 3
/** Repository, #, Title, You, Review, CI, Conflict, Waiting on, Age, Activity, Size. */
const COLUMN_COUNT = 11

type Props = {
  prs: PullRequest[]
  /** null when ungrouped. Non-null also suppresses the Repository column. */
  groups: RepoGroup[] | null
  collapsedRepos: Record<string, boolean>
  onToggleRepo: (repo: string) => void
  config: AppConfig
  onOpen?: (pr: PullRequest) => void
}

export default function PrTable({
  prs,
  groups,
  collapsedRepos,
  onToggleRepo,
  config,
  onOpen,
}: Props) {
  const showRepo = groups === null

  return (
    <div className="table-scroll">
      <table className="prs">
        <thead>
          <tr>
            {showRepo && <th>Repository</th>}
            <th className="num">#</th>
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
                  onToggle={() => onToggleRepo(group.repo)}
                  config={config}
                  onOpen={onOpen}
                />
              ))
            : prs.map((pr) => <Row key={pr.id} pr={pr} config={config} onOpen={onOpen} showRepo />)}
        </tbody>
      </table>
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
  const f = prFacts(pr, config)

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
    >
      {showRepo && (
        <td className="cell-repo" title={pr.repo}>
          {f.repoName}
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
          {f.authorLabel && <span>{f.authorLabel}</span>}
          {f.ownReview && <span>{f.ownReview}</span>}
          {f.ticket && (
            <a
              href={f.ticket.href}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              {f.ticket.key}
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
        {f.review ? (
          <span className={`badge ${f.review.className}`}>{f.review.label}</span>
        ) : (
          <span className="absent" aria-label="none">
            {'\u00b7'}
          </span>
        )}
      </td>
      <td>
        <span className={`ci-dot ${f.ciClass}`} title={f.ciTitle} />
      </td>
      <td>
        <span
          className={`conflict-dot ${f.hasConflict ? 'has-conflict' : ''}`}
          title={f.hasConflict ? 'Has merge conflicts' : 'No conflicts detected'}
        />
      </td>
      <td className="col-optional">
        {pr.waitingOn.length > 0 ? (
          <span className="avatars">
            {pr.waitingOn.slice(0, MAX_AVATARS).map((r) => (
              <img key={r.login} src={r.avatarUrl} alt={r.login} title={r.login} />
            ))}
            {pr.waitingOn.length > MAX_AVATARS && (
              <span className="avatars-more">+{pr.waitingOn.length - MAX_AVATARS}</span>
            )}
          </span>
        ) : (
          <span className="absent" aria-label="none">
            {'\u00b7'}
          </span>
        )}
      </td>
      <td className={`col-compact num ${f.ageClass}`}>{f.age}</td>
      <td className="col-compact num cell-activity">{f.activity}</td>
      <td className="col-optional num" title={`${pr.changedFiles} files changed`}>
        <span className="diff-add">+{pr.additions}</span>{' '}
        <span className="diff-del">
          {'−'}
          {pr.deletions}
        </span>
      </td>
    </tr>
  )
}
