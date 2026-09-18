import { nextTheme, THEME_LABEL, type Theme } from '../hooks/useTheme'
import { relativeAge } from '../lib/dates'

type Props = {
  username: string
  org: string
  updatedAt: Date | null
  loading: boolean
  theme: Theme
  onThemeChange: (theme: Theme) => void
  onRefresh: () => void
  onOpenSettings: () => void
}

export default function Header({
  username,
  org,
  updatedAt,
  loading,
  theme,
  onThemeChange,
  onRefresh,
  onOpenSettings,
}: Props) {
  return (
    <header className={loading ? 'header is-loading' : 'header'}>
      <div className="brand">
        Hubble <small>deep field, one org</small>
      </div>

      <div className="header-scope">
        <strong>{username}</strong>
        {org ? (
          <>
            {' in '}
            <strong>{org}</strong>
          </>
        ) : (
          ' across every repo your token can see'
        )}
      </div>

      <div className="spacer" />

      <div className="header-actions">
        {updatedAt && !loading && (
          <span className="header-scope">Updated {relativeAge(updatedAt.toISOString())}</span>
        )}
        <button className="btn btn-sm" onClick={onRefresh} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => onThemeChange(nextTheme(theme))}
          title={`Theme: ${THEME_LABEL[theme]}`}
        >
          {THEME_LABEL[theme]}
        </button>
        <button className="btn btn-sm btn-ghost" onClick={onOpenSettings}>
          Settings
        </button>
      </div>
    </header>
  )
}
