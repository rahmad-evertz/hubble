import { useCallback, useEffect, useRef, useState } from 'react'
import { isValidLogin } from '../lib/validate'
import type { AppConfig } from '../types'

const REFRESH_OPTIONS = [0, 1, 2, 5, 10, 15, 30]

type Props = {
  config: AppConfig
  refreshMinutes: number
  viewerLogin: string | null
  onSave: (config: AppConfig, refreshMinutes: number) => void
  onSignOut: () => void
  onClose: () => void
}

export default function Settings({
  config,
  refreshMinutes,
  viewerLogin,
  onSave,
  onSignOut,
  onClose,
}: Props) {
  const [username, setUsername] = useState(config.username)
  const [org, setOrg] = useState(config.org)
  const [minutes, setMinutes] = useState(refreshMinutes)
  const [ticketPattern, setTicketPattern] = useState(config.ticketPattern)
  const [ticketBaseUrl, setTicketBaseUrl] = useState(config.ticketBaseUrl)
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
    if (ticketPattern) {
      try {
        new RegExp(ticketPattern)
      } catch {
        setError('The issue-key pattern is not a valid regular expression.')
        return
      }
    }
    onSave(
      {
        ...config,
        username: username.trim(),
        org: org.trim(),
        ticketPattern: ticketPattern.trim(),
        ticketBaseUrl: ticketBaseUrl.trim(),
      },
      minutes,
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
            <label htmlFor="s-pattern">Issue-key pattern (optional)</label>
            <input
              id="s-pattern"
              type="text"
              value={ticketPattern}
              spellCheck={false}
              placeholder="([A-Z]{2,}-\d+)"
              onChange={(e) => setTicketPattern(e.target.value)}
            />
            <div className="hint">
              A regular expression matched against each pull-request title. With a base URL below,
              the first capture group becomes a link to your issue tracker.
            </div>
          </div>

          <div className="field">
            <label htmlFor="s-base">Issue tracker base URL (optional)</label>
            <input
              id="s-base"
              type="text"
              value={ticketBaseUrl}
              spellCheck={false}
              placeholder="https://tracker.example.com/browse"
              onChange={(e) => setTicketBaseUrl(e.target.value)}
            />
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
