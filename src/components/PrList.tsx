import { useMemo, useState } from 'react'
import type { PrView } from '../lib/deckLayout'
import { groupByRepo, sortPrs, type SortKey } from '../lib/sortPrs'
import * as storage from '../lib/storage'
import type { AppConfig, PullRequest } from '../types'
import PrDeck from './PrDeck'
import PrTable from './PrTable'

type Props = {
  prs: PullRequest[]
  config: AppConfig
  emptyTitle: string
  emptyBody: string
  onOpen?: (pr: PullRequest) => void
}

/**
 * Owns the view state for both PR views and renders the frame around them.
 *
 * The frame lives here rather than as a .card in App, because the deck has to
 * escape `overflow: hidden` to lift out of its plane, and only this component
 * knows which view is active.
 */
export default function PrList({ prs, config, emptyTitle, emptyBody, onOpen }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>(() => storage.read<SortKey>('prSort', 'activity'))
  const [grouped, setGrouped] = useState(() => storage.read('prGroupByRepo', false))
  const [view, setView] = useState<PrView>(() => storage.read<PrView>('prView', 'deck'))
  const [collapsedRepos, setCollapsedRepos] = useState<Record<string, boolean>>({})

  const sorted = useMemo(() => sortPrs(prs, sortKey), [prs, sortKey])
  const groups = useMemo(() => (grouped ? groupByRepo(sorted) : null), [grouped, sorted])

  if (prs.length === 0) {
    return (
      <div className="pr-list pr-list-flat">
        <div className="empty">
          <strong>{emptyTitle}</strong>
          {emptyBody}
        </div>
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

  function updateView(next: PrView) {
    storage.write('prView', next)
    setView(next)
  }

  const shared = {
    prs: sorted,
    groups,
    collapsedRepos,
    onToggleRepo: (repo: string) => setCollapsedRepos((prev) => ({ ...prev, [repo]: !prev[repo] })),
    config,
    onOpen,
  }

  return (
    <div className={`pr-list${view === 'deck' ? ' pr-list-deck' : ' pr-list-flat'}`}>
      <div className="pr-table-toolbar">
        <div className="sort-control" role="group" aria-label="Sort by">
          <button
            className={`btn btn-sm ${sortKey === 'activity' ? 'btn-primary' : ''}`}
            aria-pressed={sortKey === 'activity'}
            onClick={() => updateSort('activity')}
          >
            Activity
          </button>
          <button
            className={`btn btn-sm ${sortKey === 'age' ? 'btn-primary' : ''}`}
            aria-pressed={sortKey === 'age'}
            onClick={() => updateSort('age')}
          >
            Age
          </button>
        </div>
        <button className="btn btn-sm" aria-pressed={grouped} onClick={toggleGrouped}>
          {grouped ? 'Ungroup' : 'Group by repo'}
        </button>
        {/* Says out loud what the deck's near-to-far axis means, which is
            otherwise only implied by the sort buttons. */}
        {view === 'deck' && (
          <span className="deck-hint">
            nearest: {sortKey === 'age' ? 'oldest' : 'most recent activity'}
          </span>
        )}
        <div className="view-control" role="group" aria-label="View">
          <button
            className={`btn btn-sm ${view === 'deck' ? 'btn-primary' : ''}`}
            aria-pressed={view === 'deck'}
            onClick={() => updateView('deck')}
          >
            Deck
          </button>
          <button
            className={`btn btn-sm ${view === 'table' ? 'btn-primary' : ''}`}
            aria-pressed={view === 'table'}
            onClick={() => updateView('table')}
          >
            Table
          </button>
        </div>
      </div>

      {view === 'deck' ? <PrDeck {...shared} /> : <PrTable {...shared} />}
    </div>
  )
}
