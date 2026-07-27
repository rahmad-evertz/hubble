import { useState } from 'react'
import { linkify } from '../lib/linkify'
import type { ReviewComment } from '../types'

type Props = {
  comments: ReviewComment[]
  onReply: (body: string) => Promise<unknown>
  replyLabel?: string
  resolved?: boolean
  isOutdated?: boolean
}

export default function CommentThread({
  comments,
  onReply,
  replyLabel = 'Reply',
  resolved,
  isOutdated,
}: Props) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [replying, setReplying] = useState(false)

  const handleReply = async () => {
    if (!draft.trim()) return
    setBusy(true)
    setError(null)
    try {
      await onReply(draft)
      setDraft('')
      setReplying(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="diff-thread-row">
      <div className="comment-thread">
        {resolved && <div className="thread-resolved-bar">✓ Resolved</div>}
        {isOutdated && <div className="thread-resolved-bar">Outdated</div>}
        {comments.map((comment) => (
          <div key={comment.id} className="comment">
            <div className="comment-head">
              <span className="comment-author">{comment.author.login}</span>
              <span className="comment-time">{new Date(comment.createdAt).toLocaleString()}</span>
            </div>
            <div className="comment-body">
              <pre>
                {linkify(comment.body).map((segment, i) =>
                  segment.type === 'text' ? (
                    <span key={i}>{segment.value}</span>
                  ) : (
                    <a key={i} href={segment.href} target="_blank" rel="noreferrer">
                      {segment.value}
                    </a>
                  ),
                )}
              </pre>
            </div>
          </div>
        ))}
        {replying ? (
          <div className="comment-reply">
            <textarea
              placeholder={`${replyLabel}...`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={busy}
            />
            {error && <div className="alert alert-error">{error}</div>}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-sm" onClick={() => setReplying(false)} disabled={busy}>
                Cancel
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={handleReply}
                disabled={busy || !draft.trim()}
              >
                {busy ? 'Posting…' : replyLabel}
              </button>
            </div>
          </div>
        ) : (
          <button className="btn btn-sm btn-ghost" onClick={() => setReplying(true)}>
            {replyLabel}
          </button>
        )}
      </div>
    </div>
  )
}
