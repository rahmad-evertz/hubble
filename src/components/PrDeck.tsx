import { useMemo, type CSSProperties } from 'react'
import { deckLayout, type DeckCard } from '../lib/deckLayout'
import { prFacts, ROLE_BADGE } from '../lib/prFacts'
import type { RepoGroup } from '../lib/sortPrs'
import type { AppConfig, PullRequest } from '../types'

const MAX_AVATARS = 3

/** Custom properties are absent from CSSProperties, so the cast lives here once. */
function cardVars(card: DeckCard): CSSProperties {
  return { '--depth': card.depth, '--urgency': card.urgency } as CSSProperties
}

type Props = {
  prs: PullRequest[]
  /** null when ungrouped, which renders exactly one shelf. */
  groups: RepoGroup[] | null
  collapsedRepos: Record<string, boolean>
  onToggleRepo: (repo: string) => void
  config: AppConfig
  onOpen?: (pr: PullRequest) => void
}

export default function PrDeck({
  prs,
  groups,
  collapsedRepos,
  onToggleRepo,
  config,
  onOpen,
}: Props) {
  if (!groups) {
    return <DeckShelf prs={prs} repo={null} config={config} onOpen={onOpen} showRepo />
  }

  return (
    <div className="deck-shelves">
      {groups.map((group) => (
        <DeckShelf
          key={group.repo}
          prs={group.prs}
          repo={group.repo}
          collapsed={collapsedRepos[group.repo] ?? false}
          onToggle={() => onToggleRepo(group.repo)}
          config={config}
          onOpen={onOpen}
          showRepo={false}
        />
      ))}
    </div>
  )
}

/**
 * One perspective plane. Grouped mode gives each repo its own, because a single
 * shared vanishing point would skew every shelf not centred under it.
 */
function DeckShelf({
  prs,
  repo,
  collapsed = false,
  onToggle,
  config,
  onOpen,
  showRepo,
}: {
  prs: PullRequest[]
  repo: string | null
  collapsed?: boolean
  onToggle?: () => void
  config: AppConfig
  onOpen?: (pr: PullRequest) => void
  showRepo: boolean
}) {
  // Cannot live inside a .map(), which is why a shelf is its own component.
  const layout = useMemo(() => deckLayout(prs), [prs])
  const [, repoName] = repo ? repo.split('/') : [null, null]

  return (
    <div className="deck-shelf">
      {repo && onToggle && (
        <button className="repo-group-head" aria-expanded={!collapsed} onClick={onToggle}>
          <span className="chevron">{collapsed ? '▸' : '▾'}</span>
          {repoName ?? repo}
          <span className="tab-count">{prs.length}</span>
        </button>
      )}
      {!collapsed && (
        <div className="deck scene">
          <div className="deck-stage scene-stage">
            {/* role="list" because list-style: none strips list semantics in
                Safari and VoiceOver. */}
            <ul className="deck-stack" role="list">
              {prs.map((pr, i) => (
                <PrCard
                  key={pr.id}
                  pr={pr}
                  card={layout[i]}
                  config={config}
                  onOpen={onOpen}
                  showRepo={showRepo}
                />
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

function PrCard({
  pr,
  card,
  config,
  onOpen,
  showRepo,
}: {
  pr: PullRequest
  card: DeckCard
  config: AppConfig
  onOpen?: (pr: PullRequest) => void
  showRepo: boolean
}) {
  const f = prFacts(pr, config)

  return (
    <li className="pr-card" style={cardVars(card)}>
      {/* A real button, and a sibling of the links rather than their parent: a
          <button> may not contain an <a>. Enter and Space come for free, and
          nothing bubbles into the open handler. */}
      {onOpen && (
        <button
          className="pr-card-open"
          aria-label={`Open details for ${pr.title}`}
          onClick={() => onOpen(pr)}
        />
      )}

      <div className="pr-card-spine">
        <span className="cell-num">#{pr.number}</span>
        <a className="pr-title" href={pr.url} target="_blank" rel="noreferrer">
          {pr.title}
        </a>
        <span className="pr-card-dots">
          <span className={`ci-dot ${f.ciClass}`} role="img" aria-label={f.ciTitle} />
          <span
            className={`conflict-dot ${f.hasConflict ? 'has-conflict' : ''}`}
            role="img"
            aria-label={f.hasConflict ? 'Has merge conflicts' : 'No conflicts detected'}
          />
        </span>
      </div>

      {/* Absent facts are omitted rather than placeholdered: a card has no
          columns to keep aligned. */}
      <div className="pr-sub">
        {showRepo && (
          <span className="cell-repo" title={pr.repo}>
            {f.repoName}
          </span>
        )}
        {pr.isDraft && <span className="badge badge-neutral">Draft</span>}
        {f.authorLabel && <span>{f.authorLabel}</span>}
        {f.ownReview && <span>{f.ownReview}</span>}
        {f.ticket && (
          <a href={f.ticket.href} target="_blank" rel="noreferrer">
            {f.ticket.key}
          </a>
        )}
        <span className={`num ${f.ageClass}`} title="Opened">
          {f.age}
        </span>
        <span className="num col-compact cell-activity" title="Last activity">
          {f.activity}
        </span>
      </div>

      <div className="pr-card-facts">
        <div className="roles">
          {pr.roles.map((role) => (
            <span key={role} className={`badge ${ROLE_BADGE[role].className}`}>
              {ROLE_BADGE[role].label}
            </span>
          ))}
        </div>
        {f.review && (
          <span className={`badge ${f.review.className} col-optional`}>{f.review.label}</span>
        )}
        {pr.waitingOn.length > 0 && (
          <span className="avatars col-optional">
            {pr.waitingOn.slice(0, MAX_AVATARS).map((r) => (
              <img key={r.login} src={r.avatarUrl} alt={r.login} title={r.login} />
            ))}
            {pr.waitingOn.length > MAX_AVATARS && (
              <span className="avatars-more">+{pr.waitingOn.length - MAX_AVATARS}</span>
            )}
          </span>
        )}
        <span className="num col-optional" title={`${pr.changedFiles} files changed`}>
          <span className="diff-add">+{pr.additions}</span>{' '}
          <span className="diff-del">
            {'−'}
            {pr.deletions}
          </span>
        </span>
      </div>
    </li>
  )
}
