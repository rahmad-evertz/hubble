import { useCallback, useEffect, useState } from 'react'
import { AuthError, type Credentials } from '../api/client'
import {
  fetchPrDetail,
  fetchPrFiles,
  submitReview,
  replyToReviewThread,
  addConversationComment,
  closePullRequestWithComment,
  setDraftState,
  type CloseResult,
} from '../api/prDetail'
import type { PrDetail, PrFile, ReviewComment, ReviewEvent, ReviewState } from '../types'

export type PrIdentity = { id: string; repo: string; number: number }

export type PrMutationEffect =
  | { type: 'review'; userLatestReview: ReviewState }
  | { type: 'draft'; isDraft: boolean }
  | { type: 'closed' }

export type PrDetailData = PrDetail & { files: PrFile[]; filesTruncated: boolean }

export type PrDetailState = {
  data: PrDetailData | null
  loading: boolean
  error: Error | null
  refresh: () => void
  mutating: boolean
  submitReview: (event: ReviewEvent, body: string) => Promise<void>
  toggleDraft: () => Promise<void>
  close: (commentBody?: string) => Promise<CloseResult>
  replyToThread: (threadId: string, body: string) => Promise<ReviewComment>
  addComment: (body: string) => Promise<ReviewComment>
}

export function usePrDetail(
  pr: PrIdentity,
  creds: Credentials,
  enabled: boolean,
  onMutated?: (effect: PrMutationEffect) => void,
): PrDetailState {
  const [data, setData] = useState<PrDetailData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [nonce, setNonce] = useState(0)
  const [mutating, setMutating] = useState(false)

  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    setLoading(true)
    setError(null)

    Promise.all([fetchPrDetail(pr.repo, pr.number, creds), fetchPrFiles(pr.repo, pr.number, creds)])
      .then(([detail, { files, truncated }]) => {
        if (!cancelled) {
          setData({ ...detail, files, filesTruncated: truncated })
          setLoading(false)
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setError(e)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [pr.id, pr.repo, pr.number, creds, enabled, nonce])

  const handleSubmitReview = useCallback(
    async (event: ReviewEvent, body: string): Promise<void> => {
      setMutating(true)
      setError(null)
      try {
        const state = await submitReview(pr.id, event, body, creds)
        if (data) {
          setData({ ...data, reviewDecision: 'APPROVED' })
        }
        onMutated?.({ type: 'review', userLatestReview: state as ReviewState })
      } catch (e) {
        if (e instanceof AuthError) throw e
        setError(e instanceof Error ? e : new Error(String(e)))
      } finally {
        setMutating(false)
      }
    },
    [pr.id, data, creds, onMutated],
  )

  const handleToggleDraft = useCallback(async (): Promise<void> => {
    if (!data) return
    setMutating(true)
    setError(null)
    try {
      const newDraft = await setDraftState(pr.id, !data.isDraft, creds)
      setData({ ...data, isDraft: newDraft })
      onMutated?.({ type: 'draft', isDraft: newDraft })
    } catch (e) {
      if (e instanceof AuthError) throw e
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setMutating(false)
    }
  }, [pr.id, data, creds, onMutated])

  const handleClose = useCallback(
    async (commentBody?: string): Promise<CloseResult> => {
      setMutating(true)
      setError(null)
      try {
        const result = await closePullRequestWithComment(pr.id, commentBody ?? null, creds)
        if (result.closed && data) {
          setData({ ...data, state: 'CLOSED' })
          onMutated?.({ type: 'closed' })
        }
        if (result.error) {
          setError(new Error(result.error))
        }
        return result
      } catch (e) {
        if (e instanceof AuthError) throw e
        const err = e instanceof Error ? e : new Error(String(e))
        setError(err)
        return { closed: false, commentPosted: false, error: err.message }
      } finally {
        setMutating(false)
      }
    },
    [pr.id, data, creds, onMutated],
  )

  const handleReplyToThread = useCallback(
    async (threadId: string, body: string): Promise<ReviewComment> => {
      setMutating(true)
      setError(null)
      try {
        const comment = await replyToReviewThread(threadId, body, creds)
        // Append the new comment to the thread
        if (data) {
          const updated = {
            ...data,
            reviewThreads: data.reviewThreads.map((thread) =>
              thread.id === threadId
                ? { ...thread, comments: [...thread.comments, comment] }
                : thread,
            ),
          }
          setData(updated)
        }
        return comment
      } catch (e) {
        if (e instanceof AuthError) throw e
        const err = e instanceof Error ? e : new Error(String(e))
        setError(err)
        throw err
      } finally {
        setMutating(false)
      }
    },
    [data, creds],
  )

  const handleAddComment = useCallback(
    async (body: string): Promise<ReviewComment> => {
      setMutating(true)
      setError(null)
      try {
        const comment = await addConversationComment(pr.id, body, creds)
        // Append to general comments
        if (data) {
          setData({ ...data, comments: [...data.comments, comment] })
        }
        return comment
      } catch (e) {
        if (e instanceof AuthError) throw e
        const err = e instanceof Error ? e : new Error(String(e))
        setError(err)
        throw err
      } finally {
        setMutating(false)
      }
    },
    [pr.id, data, creds],
  )

  return {
    data,
    loading,
    error,
    refresh,
    mutating,
    submitReview: handleSubmitReview,
    toggleDraft: handleToggleDraft,
    close: handleClose,
    replyToThread: handleReplyToThread,
    addComment: handleAddComment,
  }
}
