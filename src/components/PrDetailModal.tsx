import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePrDetail, type PrMutationEffect, type PrDetailData } from '../hooks/usePrDetail'
import { type Credentials } from '../api/client'
import type { PullRequest } from '../types'
import DiffFile from './DiffFile'
import CommentThread from './CommentThread'

type Props = {
  pr: PullRequest
  creds: Credentials
  viewerLogin: string | null
  onClose: () => void
  onMutated: (prId: string, effect: PrMutationEffect) => void
}

type PendingAction = 'approve' | 'review' | 'close' | null

export default function PrDetailModal({ pr, creds, viewerLogin, onClose, onMutated }: Props) {
  const detail = usePrDetail(
    { id: pr.id, repo: pr.repo, number: pr.number },
    creds,
    true,
    (effect) => onMutated(pr.id, effect),
  )

  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [actionBody, setActionBody] = useState('')
  /** Separate from actionBody: they are different composers on screen at once. */
  const [commentBody, setCommentBody] = useState('')
  const [commentError, setCommentError] = useState<string | null>(null)
  const [conversationOpen, setConversationOpen] = useState(true)
  const [reviewChoice, setReviewChoice] = useState<'REQUEST_CHANGES' | 'COMMENT'>('REQUEST_CHANGES')
  const [actionError, setActionError] = useState<string | null>(null)

  // The exit animation is owned here rather than in App, because this is where
  // the animation lives. App's selectedPrId still flips to null exactly once,
  // just one frame later.
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
    // animationend never arrives if animations are disabled outright, and the
    // modal still has to close.
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

  const threadsByPath = useMemo(() => {
    if (!detail.data) return new Map<string, PrDetailData['reviewThreads']>()
    const map = new Map<string, PrDetailData['reviewThreads']>()
    for (const thread of detail.data.reviewThreads) {
      if (!map.has(thread.path)) {
        map.set(thread.path, [])
      }
      map.get(thread.path)!.push(thread)
    }
    return map
  }, [detail.data])

  const handleApprove = useCallback(async () => {
    setActionError(null)
    try {
      await detail.submitReview('APPROVE', actionBody)
      setPendingAction(null)
      setActionBody('')
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    }
  }, [detail, actionBody])

  const handleReview = useCallback(async () => {
    setActionError(null)
    if (!actionBody.trim()) {
      setActionError('A comment is required for this action.')
      return
    }
    try {
      await detail.submitReview(reviewChoice, actionBody)
      setPendingAction(null)
      setActionBody('')
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    }
  }, [detail, actionBody, reviewChoice])

  const handleToggleDraft = useCallback(async () => {
    setActionError(null)
    try {
      await detail.toggleDraft()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    }
  }, [detail])

  const handleClose = useCallback(async () => {
    setActionError(null)
    try {
      const result = await detail.close(actionBody || undefined)
      if (result.closed) {
        requestClose()
      } else if (result.error) {
        setActionError(result.error)
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    }
  }, [detail, actionBody, requestClose])

  const canApprove = viewerLogin && pr.authorLogin !== viewerLogin
  const approveDisabledReason = !canApprove ? `You can't approve your own PR` : undefined

  const [confirmingClose, setConfirmingClose] = useState(false)

  return (
    <div
      className={closing ? 'modal-backdrop is-closing' : 'modal-backdrop'}
      onClick={requestClose}
    >
      <div
        className={closing ? 'modal modal-lg is-closing' : 'modal modal-lg'}
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={(e) => {
          // Child animations bubble here, so only the panel's own exit counts.
          if (closing && e.target === e.currentTarget) finishClose()
        }}
      >
        <div className="modal-head">
          <div className="pr-detail-title">
            <h2>{detail.data?.title ?? pr.title}</h2>
            <div className="pr-detail-meta">
              {pr.repo} #{pr.number}
              {(detail.data?.isDraft ?? pr.isDraft) && (
                <span className="badge badge-neutral">Draft</span>
              )}
              {detail.data && detail.data.reviewDecision && (
                <span
                  className={`badge ${
                    detail.data.reviewDecision === 'APPROVED' ? 'badge-success' : 'badge-danger'
                  }`}
                >
                  {detail.data.reviewDecision === 'APPROVED'
                    ? 'Approved'
                    : detail.data.reviewDecision === 'CHANGES_REQUESTED'
                      ? 'Changes requested'
                      : 'Review required'}
                </span>
              )}
            </div>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={requestClose}>
            Close
          </button>
        </div>

        <div className="pr-actions-bar">
          {pendingAction === 'approve' ? (
            <div className="action-composer">
              <textarea
                placeholder="Add an optional comment to your approval..."
                value={actionBody}
                onChange={(e) => setActionBody(e.target.value)}
                disabled={detail.mutating}
              />
              {actionError && <div className="alert alert-error">{actionError}</div>}
              <div className="row-actions">
                <button
                  className="btn btn-sm"
                  onClick={() => setPendingAction(null)}
                  disabled={detail.mutating}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-sm btn-success"
                  onClick={handleApprove}
                  disabled={detail.mutating}
                >
                  {detail.mutating ? 'Approving…' : 'Approve'}
                </button>
              </div>
            </div>
          ) : pendingAction === 'review' ? (
            <div className="action-composer">
              <div className="action-choice">
                <label>
                  <input
                    type="radio"
                    checked={reviewChoice === 'REQUEST_CHANGES'}
                    onChange={() => setReviewChoice('REQUEST_CHANGES')}
                    disabled={detail.mutating}
                  />{' '}
                  Request changes
                </label>
                <label>
                  <input
                    type="radio"
                    checked={reviewChoice === 'COMMENT'}
                    onChange={() => setReviewChoice('COMMENT')}
                    disabled={detail.mutating}
                  />{' '}
                  Just comment
                </label>
              </div>
              <textarea
                placeholder="What needs to change?"
                value={actionBody}
                onChange={(e) => setActionBody(e.target.value)}
                disabled={detail.mutating}
              />
              {actionError && <div className="alert alert-error">{actionError}</div>}
              <div className="row-actions">
                <button
                  className="btn btn-sm"
                  onClick={() => setPendingAction(null)}
                  disabled={detail.mutating}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={handleReview}
                  disabled={detail.mutating}
                >
                  {detail.mutating ? 'Submitting…' : 'Submit'}
                </button>
              </div>
            </div>
          ) : pendingAction === 'close' ? (
            <div className="action-composer">
              {!confirmingClose ? (
                <div>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => setConfirmingClose(true)}
                    disabled={detail.mutating}
                  >
                    Confirm close
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => setPendingAction(null)}
                    disabled={detail.mutating}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div>
                  <textarea
                    placeholder="Optional closing comment (e.g. 'closing in favor of #123')..."
                    value={actionBody}
                    onChange={(e) => setActionBody(e.target.value)}
                    disabled={detail.mutating}
                  />
                  {actionError && <div className="alert alert-error">{actionError}</div>}
                  <div className="row-actions">
                    <button
                      className="btn btn-sm"
                      onClick={() => setConfirmingClose(false)}
                      disabled={detail.mutating}
                    >
                      Back
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={handleClose}
                      disabled={detail.mutating}
                    >
                      {detail.mutating ? 'Closing…' : 'Close PR'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="row-actions row-actions-start">
              <button
                className="btn btn-success"
                onClick={() => setPendingAction('approve')}
                disabled={detail.mutating || !canApprove}
                title={approveDisabledReason}
              >
                Approve
              </button>
              <button
                className="btn"
                onClick={() => setPendingAction('review')}
                disabled={detail.mutating || !canApprove}
                title={approveDisabledReason}
              >
                {reviewChoice === 'REQUEST_CHANGES' ? 'Request changes' : 'Comment'}
              </button>
              <button className="btn" onClick={handleToggleDraft} disabled={detail.mutating}>
                {(detail.data?.isDraft ?? pr.isDraft) ? 'Mark ready' : 'Mark draft'}
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  setConfirmingClose(false)
                  setPendingAction('close')
                }}
                disabled={detail.mutating}
              >
                Close
              </button>
            </div>
          )}
        </div>

        <div className="modal-body">
          {detail.loading && !detail.data ? (
            <div className="skeleton">Loading diff…</div>
          ) : detail.error ? (
            <div>
              <div className="alert alert-error">{detail.error.message}</div>
              <button className="btn btn-sm" onClick={detail.refresh}>
                Retry
              </button>
            </div>
          ) : !detail.data ? (
            <div className="skeleton">Loading…</div>
          ) : detail.data.files.length === 0 ? (
            <div className="empty">
              <strong>No changes</strong>
              This pull request has no file changes.
            </div>
          ) : (
            <div>
              <div className="pr-files-summary">
                {detail.data.files.length} files changed
                {detail.data.files.reduce((a, f) => a + f.additions, 0) > 0 && (
                  <span className="diff-add">
                    +{detail.data.files.reduce((a, f) => a + f.additions, 0)}
                  </span>
                )}
                {detail.data.files.reduce((a, f) => a + f.deletions, 0) > 0 && (
                  <span className="diff-del">
                    −{detail.data.files.reduce((a, f) => a + f.deletions, 0)}
                  </span>
                )}
                {detail.data.filesTruncated && <span className="absent">and more…</span>}
              </div>

              {detail.data.files.map((file) => (
                <DiffFile
                  key={file.path}
                  file={file}
                  threads={threadsByPath.get(file.path) ?? []}
                  onReplyToThread={(threadId, body) => detail.replyToThread(threadId, body)}
                />
              ))}

              {(detail.data.comments.length > 0 || detail.data.reviews.length > 0) && (
                <div className="pr-conversation">
                  <button
                    className="section-head"
                    aria-expanded={conversationOpen}
                    onClick={() => setConversationOpen((v) => !v)}
                  >
                    <span className="chevron">{conversationOpen ? '▾' : '▸'}</span>
                    <span>Conversation</span>
                    <span className="tab-count">
                      {detail.data.comments.length + detail.data.reviews.length}
                    </span>
                  </button>
                  <div className={conversationOpen ? 'thread-stack' : 'thread-stack is-collapsed'}>
                    {detail.data.comments.map((comment) => (
                      <CommentThread
                        key={comment.id}
                        comments={[comment]}
                        onReply={(body) => detail.addComment(body)}
                        replyLabel="Reply"
                      />
                    ))}
                    {detail.data.reviews.map((review) => (
                      <div key={review.id} className="pr-review-summary">
                        <div className="comment-head">
                          <span className="comment-author">{review.author.login}</span>
                          <span
                            className={`badge badge-${review.state === 'APPROVED' ? 'success' : 'danger'}`}
                          >
                            {review.state === 'APPROVED' ? 'Approved' : review.state}
                          </span>
                        </div>
                        {review.body && (
                          <div className="comment-body">
                            <pre>{review.body}</pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unconditional. This used to render only when a pull request had
                  no comments and no reviews at all, so you could not comment on
                  anything with an existing conversation. */}
              <div className="pr-comment-form">
                <h3>Add a comment</h3>
                <textarea
                  placeholder="Share your thoughts..."
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  disabled={detail.mutating}
                />
                {commentError && <div className="alert alert-error">{commentError}</div>}
                <div className="row-actions">
                  <button
                    className="btn btn-primary"
                    onClick={async () => {
                      setCommentError(null)
                      try {
                        await detail.addComment(commentBody)
                        setCommentBody('')
                      } catch (e) {
                        setCommentError(e instanceof Error ? e.message : String(e))
                      }
                    }}
                    disabled={detail.mutating || !commentBody.trim()}
                  >
                    {detail.mutating ? 'Posting…' : 'Comment'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
