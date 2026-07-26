import { useMemo, useState } from 'react'
import { reasonLabel, reasonRank } from '../api/notifications'
import { relativeAge } from '../lib/dates'
import type { NotificationItem } from '../types'

type Props = {
  items: NotificationItem[]
  /** False when the dashboard is pointed at someone other than the token owner. */
  available: boolean
  viewerLogin: string
  username: string
  marking: boolean
  onMarkRead: (ids: string[]) => void
}

export default function NotificationInbox({
  items,
  available,
  viewerLogin,
  username,
  marking,
  onMarkRead,
}: Props) {
  const [hideBots, setHideBots] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [confirmingBulk, setConfirmingBulk] = useState(false)

  const botCount = useMemo(() => items.filter((i) => i.isBot).length, [items])

  const groups = useMemo(() => {
    const visible = hideBots ? items.filter((i) => !i.isBot) : items
    const byReason = new Map<string, NotificationItem[]>()
    for (const item of visible) {
      const list = byReason.get(item.reason) ?? []
      list.push(item)
      byReason.set(item.reason, list)
    }
    for (const list of byReason.values()) {
      list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    }
    // Most-demanding reasons first, so review requests outrank CI chatter.
    return [...byReason.entries()].sort(
      ([a], [b]) => reasonRank(a) - reasonRank(b) || a.localeCompare(b),
    )
  }, [items, hideBots])

  /** Only what is currently on screen — never the whole account. */
  const shownIds = useMemo(() => groups.flatMap(([, list]) => list.map((i) => i.id)), [groups])

  if (!available) {
    return (
      <div className="empty">
        <strong>The inbox only ever shows your own notifications</strong>
        GitHub exposes no API for reading another user&apos;s notifications, so with the dashboard
        pointed at <code>{username}</code> while your token belongs to <code>{viewerLogin}</code>,
        there is nothing truthful to show here. Switch the username in Settings to see your inbox.
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="empty">
        <strong>Inbox clear</strong>
        No unread notifications in this scope.
      </div>
    )
  }

  return (
    <div className="card">
      <div className="panel-head">
        <h2>{items.length} unread</h2>
        <span className="note">grouped by why GitHub notified you</span>
        <div style={{ flex: 1 }} />
        {botCount > 0 && (
          <button
            className="btn btn-sm btn-ghost"
            disabled={marking}
            onClick={() => setHideBots((v) => !v)}
          >
            {hideBots ? `Show bots (${botCount})` : `Hide bots (${botCount})`}
          </button>
        )}
        {/* Two-step, because marking read cannot be undone from the API and the
            count can be in the hundreds. The label names the exact scope so it
            can never be mistaken for "mark my whole account read". */}
        {confirmingBulk ? (
          <>
            <span className="note">Mark {shownIds.length} shown as read?</span>
            <button
              className="btn btn-sm btn-primary"
              disabled={marking}
              onClick={() => {
                onMarkRead(shownIds)
                setConfirmingBulk(false)
              }}
            >
              {marking ? 'Marking…' : 'Confirm'}
            </button>
            <button
              className="btn btn-sm btn-ghost"
              disabled={marking}
              onClick={() => setConfirmingBulk(false)}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            className="btn btn-sm"
            disabled={marking || shownIds.length === 0}
            onClick={() => setConfirmingBulk(true)}
          >
            Mark {shownIds.length} shown as read
          </button>
        )}
      </div>

      {groups.map(([reason, list]) => {
        const isCollapsed = collapsed[reason] ?? false
        return (
          <div className="inbox-group" key={reason}>
            <div className="inbox-group-bar">
              <button
                className="inbox-group-head"
                aria-expanded={!isCollapsed}
                onClick={() => setCollapsed((prev) => ({ ...prev, [reason]: !isCollapsed }))}
              >
                <span className="chevron">{isCollapsed ? '▸' : '▾'}</span>
                {reasonLabel(reason)}
                <span className="tab-count">{list.length}</span>
              </button>
              <button
                className="btn btn-sm btn-ghost"
                disabled={marking}
                title={`Mark all ${list.length} ${reasonLabel(reason).toLowerCase()} notifications as read`}
                onClick={() => onMarkRead(list.map((i) => i.id))}
              >
                Mark {list.length} read
              </button>
            </div>

            {!isCollapsed &&
              list.map((item) => (
                <div className="inbox-row" key={item.id}>
                  <span className="repo" title={item.repo}>
                    {item.repo.split('/')[1] ?? item.repo}
                  </span>
                  <span className="subject">
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noreferrer">
                        {item.title}
                      </a>
                    ) : (
                      item.title
                    )}
                    {item.isBot && <span className="badge badge-neutral"> bot</span>}
                    {item.subjectType !== 'PullRequest' && (
                      <span className="badge badge-neutral"> {item.subjectType}</span>
                    )}
                  </span>
                  <span className="when">{relativeAge(item.updatedAt)}</span>
                  {/* Single row: no confirmation. One notification is a small,
                      routine action, unlike the bulk paths above. */}
                  <button
                    className="btn btn-sm btn-ghost inbox-mark"
                    disabled={marking}
                    aria-label={`Mark "${item.title}" as read`}
                    title="Mark as read"
                    onClick={() => onMarkRead([item.id])}
                  >
                    ✓
                  </button>
                </div>
              ))}
          </div>
        )
      })}
    </div>
  )
}
