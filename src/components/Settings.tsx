import { useCallback, useEffect, useRef, useState } from 'react'
import { STYLE_LABEL, type Style } from '../hooks/useStyle'
import { isValidLogin } from '../lib/validate'
import type { AppConfig } from '../types'

const REFRESH_OPTIONS = [0, 1, 2, 5, 10, 15, 30]
const STYLES: Style[] = ['classic', 'glass']

type Props = {
  config: AppConfig
  refreshMinutes: number
  viewerLogin: string | null
  archivedRepos: string[]
  style: Style
  onSave: (config: AppConfig, refreshMinutes: number, archivedRepos: string[], style: Style) => void
  onSignOut: () => void
  onClose: () => void
}

export default function Settings({
  config,
  refreshMinutes,
  viewerLogin,
  archivedRepos,
  style,
  onSave,
  onSignOut,
  onClose,
}: Props) {
  const [username, setUsername] = useState(config.username)
  const [org, setOrg] = useState(config.org)
  const [minutes, setMinutes] = useState(refreshMinutes)
  const [archived, setArchived] = useState(archivedRepos)
  const [chosenStyle, setChosenStyle] = useState(style)
  const [error, setError] = useState<string | null>(null)

  const [closing, setClosing] = useState(false)
  const closedRef = useRef(false)

  const finishClose = useCallback(() => {
    if (closedRef.current) return
    closedRef.current = true
    onClose()
  }, [onClose])

  const requestClose = useCallback(() => setClosing(true), [])

  useEffect(() => {
    if (!closing) return
    const timer = window.setTimeout(finishClose, 400)
    return () => window.clearTimeout(timer)
  }, [closing, finishClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [requestClose])

  function save() {
    if (!isValidLogin(username.trim())) {
      setError('That is not a valid GitHub username.')
      return
    }
    if (org.trim() && !isValidLogin(org.trim())) {
      setError('That is not a valid organisation name.')
      return
    }
    onSave(
      {
        ...config,
        username: username.trim(),
        org: org.trim(),
      },
      minutes,
      archived,
      chosenStyle,
    )
  }

  return (
    <div
      className={closing ? 'modal-backdrop is-closing' : 'modal-backdrop'}
      onClick={requestClose}
    >
      <div
        className={closing ? 'modal is-closing' : 'modal'}
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={(e) => {
          if (closing && e.target === e.currentTarget) finishClose()
        }}
      >
        <div className="modal-head">
          <h2>Settings</h2>
          <button className="btn btn-sm btn-ghost" onClick={requestClose}>
            Close
          </button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label htmlFor="s-username">Username</label>
            <input
              id="s-username"
              type="text"
              value={username}
              spellCheck={false}
              onChange={(e) => setUsername(e.target.value)}
            />
            <div className="hint">
              {viewerLogin && username.trim() !== viewerLogin
                ? `Your token belongs to ${viewerLogin}, so the notification inbox is unavailable while this differs.`
                : 'Pull requests, reviews and stats are read for this user.'}
            </div>
          </div>

          <div className="field">
            <label htmlFor="s-org">Organisation</label>
            <input
              id="s-org"
              type="text"
              value={org}
              spellCheck={false}
              placeholder="leave blank for everything your token can see"
              onChange={(e) => setOrg(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="s-refresh">Auto-refresh</label>
            <select
              id="s-refresh"
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            >
              {REFRESH_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === 0 ? 'Off' : `Every ${option} min`}
                </option>
              ))}
            </select>
            <div className="hint">
              Notification polling is additionally clamped to the minimum interval GitHub
              advertises.
            </div>
          </div>

          <div className="field">
            <label htmlFor="s-style">Style</label>
            <select
              id="s-style"
              value={chosenStyle}
              onChange={(e) => setChosenStyle(e.target.value as Style)}
            >
              {STYLES.map((option) => (
                <option key={option} value={option}>
                  {STYLE_LABEL[option]}
                </option>
              ))}
            </select>
            <div className="hint">
              Works with every theme. Liquid glass bends the background at the edges of the header
              and tabs in Chrome and Edge.
            </div>
          </div>

          <div className="field">
            <label id="s-archived">Archived repos</label>
            {archived.length === 0 ? (
              <div className="hint">
                None. Archive a repo from its group header, or from Archive repo on any pull
                request, to hide it from every pull-request tab.
              </div>
            ) : (
              <>
                <ul className="archived-list" aria-labelledby="s-archived">
                  {archived.map((repo) => (
                    <li key={repo}>
                      <span className="cell-repo">{repo}</span>
                      <button
                        className="btn btn-sm"
                        aria-label={`Unarchive ${repo}`}
                        onClick={() => setArchived((prev) => prev.filter((r) => r !== repo))}
                      >
                        Unarchive
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="hint">Unarchived repos come back after you save.</div>
              </>
            )}
          </div>

          {error && <div className="alert alert-error">{error}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onSignOut}>
            Sign out and forget token
          </button>
          <div className="spacer" />
          <button className="btn" onClick={requestClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
