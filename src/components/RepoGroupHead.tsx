type Props = {
  repo: string
  count: number
  collapsed: boolean
  onToggle: () => void
  onArchive: () => void
}

/** Shared by the deck shelves and the table's group rows. The archive button
 *  is a sibling of the toggle, not inside it: a button cannot contain one. */
export default function RepoGroupHead({ repo, count, collapsed, onToggle, onArchive }: Props) {
  const [, repoName] = repo.split('/')

  return (
    <div className="repo-group-bar">
      <button className="repo-group-head" aria-expanded={!collapsed} onClick={onToggle}>
        <span className="chevron">{collapsed ? '▸' : '▾'}</span>
        {repoName ?? repo}
        <span className="tab-count">{count}</span>
      </button>
      <button
        className="btn btn-sm btn-ghost repo-archive"
        aria-label={`Archive ${repo}`}
        title="Hide this repo from every pull-request tab. Undo it in Settings."
        onClick={onArchive}
      >
        Archive
      </button>
    </div>
  )
}
