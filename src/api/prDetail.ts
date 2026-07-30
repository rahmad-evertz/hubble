import { graphql, nextLink, rest, type Credentials, AuthError, GitHubError } from './client'
import type {
  ReviewEvent,
  PrFile,
  PrFileStatus,
  ReviewComment,
  ReviewThread,
  ReviewSummary,
  PrDetail,
  PrState,
  DiffSide,
  ReviewState,
  Mergeable,
  ReviewDecision,
} from '../types'

const FILES_PER_PAGE = 100
const DEFAULT_MAX_FILE_PAGES = 3

const THREADS_CAP = 50
const THREAD_COMMENTS_CAP = 20
const COMMENTS_CAP = 50
const REVIEWS_CAP = 50

const PR_DETAIL_QUERY = `
query PrDetail(
  $owner: String!
  $name: String!
  $number: Int!
  $threads: Int!
  $threadComments: Int!
  $comments: Int!
  $reviews: Int!
) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      id
      number
      title
      body
      url
      state
      isDraft
      baseRefName
      headRefName
      mergeable
      reviewDecision
      reviewThreads(first: $threads) {
        totalCount
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          originalLine
          diffSide
          comments(first: $threadComments) {
            totalCount
            nodes {
              id
              body
              author {
                login
                avatarUrl
              }
              createdAt
              url
            }
          }
        }
      }
      comments(first: $comments) {
        totalCount
        nodes {
          id
          body
          author {
            login
            avatarUrl
          }
          createdAt
          url
        }
      }
      reviews(first: $reviews) {
        totalCount
        nodes {
          id
          state
          body
          author {
            login
          }
          submittedAt
        }
      }
    }
  }
  rateLimit {
    cost
    remaining
    limit
    resetAt
  }
}
`

const SUBMIT_REVIEW_MUTATION = `
mutation SubmitReview($pullRequestId: ID!, $event: PullRequestReviewEvent!, $body: String) {
  addPullRequestReview(input: { pullRequestId: $pullRequestId, event: $event, body: $body }) {
    pullRequestReview {
      id
      state
      submittedAt
    }
  }
}
`

const REPLY_TO_THREAD_MUTATION = `
mutation ReplyToThread($threadId: ID!, $body: String!) {
  addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $threadId, body: $body }) {
    comment {
      id
      body
      author {
        login
        avatarUrl
      }
      createdAt
      url
    }
  }
}
`

const ADD_COMMENT_MUTATION = `
mutation AddComment($subjectId: ID!, $body: String!) {
  addComment(input: { subjectId: $subjectId, body: $body }) {
    commentEdge {
      node {
        id
        body
        author {
          login
          avatarUrl
        }
        createdAt
        url
      }
    }
  }
}
`

const CLOSE_PR_MUTATION = `
mutation ClosePr($pullRequestId: ID!) {
  closePullRequest(input: { pullRequestId: $pullRequestId }) {
    pullRequest {
      id
      state
    }
  }
}
`

const MARK_READY_MUTATION = `
mutation MarkReady($pullRequestId: ID!) {
  markPullRequestReadyForReview(input: { pullRequestId: $pullRequestId }) {
    pullRequest {
      isDraft
    }
  }
}
`

const CONVERT_TO_DRAFT_MUTATION = `
mutation ConvertToDraft($pullRequestId: ID!) {
  convertPullRequestToDraft(input: { pullRequestId: $pullRequestId }) {
    pullRequest {
      isDraft
    }
  }
}
`

export function splitRepo(repo: string): [owner: string, name: string] {
  const [owner, name] = repo.split('/')
  if (!owner || !name) throw new Error(`"${repo}" is not a valid owner/name repository slug.`)
  return [owner, name]
}

type RawFile = {
  filename: string
  previous_filename?: string
  status: string
  additions: number
  deletions: number
  changes: number
  patch?: string
  blob_url: string
}

export async function fetchPrFiles(
  repo: string,
  number: number,
  creds: Credentials,
  maxPages = DEFAULT_MAX_FILE_PAGES,
): Promise<{ files: PrFile[]; truncated: boolean }> {
  const [owner, name] = splitRepo(repo)
  let url: string | null =
    `/repos/${owner}/${name}/pulls/${number}/files?per_page=${FILES_PER_PAGE}`
  const raw: RawFile[] = []
  let pages = 0

  while (url && pages < maxPages) {
    const res = await rest<RawFile[]>(url, creds)
    raw.push(...(res.data ?? []))
    url = nextLink(res.headers)
    pages++
  }

  return {
    files: raw.map((f) => ({
      path: f.filename,
      previousPath: f.previous_filename ?? null,
      status: f.status as PrFileStatus,
      additions: f.additions,
      deletions: f.deletions,
      changes: f.changes,
      patch: f.patch ?? null,
      blobUrl: f.blob_url,
    })),
    truncated: url !== null,
  }
}

type RawComment = {
  id: string
  body: string
  author?: { login: string; avatarUrl: string } | null
  createdAt: string
  url: string
}

type RawThread = {
  id: string
  isResolved: boolean
  isOutdated: boolean
  path: string
  line: number | null
  originalLine: number | null
  diffSide: DiffSide
  comments?: { totalCount: number; nodes: RawComment[] }
}

type RawReview = {
  id: string
  state: string
  body: string
  author?: { login: string } | null
  submittedAt: string | null
}

type RawPr = {
  id: string
  number: number
  title: string
  body: string
  url: string
  state: string
  isDraft: boolean
  baseRefName: string
  headRefName: string
  mergeable: string
  reviewDecision: string | null
  reviewThreads?: { totalCount: number; nodes: RawThread[] }
  comments?: { totalCount: number; nodes: RawComment[] }
  reviews?: { totalCount: number; nodes: RawReview[] }
}

type RawResponse = {
  repository?: {
    pullRequest?: RawPr
  }
}

function toComment(raw: RawComment): ReviewComment {
  return {
    id: raw.id,
    body: raw.body,
    author: {
      login: raw.author?.login ?? null,
      avatarUrl: raw.author?.avatarUrl ?? null,
    },
    createdAt: raw.createdAt,
    url: raw.url,
  }
}

function toThread(raw: RawThread): ReviewThread {
  const comments = raw.comments?.nodes ?? []
  const totalCount = raw.comments?.totalCount ?? 0
  return {
    id: raw.id,
    isResolved: raw.isResolved,
    isOutdated: raw.isOutdated,
    path: raw.path,
    line: raw.line,
    originalLine: raw.originalLine,
    diffSide: raw.diffSide,
    comments: comments.map(toComment),
    hasMoreComments: comments.length < totalCount,
  }
}

function toReviewSummary(raw: RawReview): ReviewSummary {
  return {
    id: raw.id,
    state: raw.state as ReviewState,
    body: raw.body,
    author: { login: raw.author?.login ?? null },
    submittedAt: raw.submittedAt,
  }
}

export async function fetchPrDetail(
  repo: string,
  number: number,
  creds: Credentials,
): Promise<PrDetail> {
  const [owner, name] = splitRepo(repo)
  const data = await graphql<RawResponse>(
    PR_DETAIL_QUERY,
    {
      owner,
      name,
      number,
      threads: THREADS_CAP,
      threadComments: THREAD_COMMENTS_CAP,
      comments: COMMENTS_CAP,
      reviews: REVIEWS_CAP,
    },
    creds,
  )

  const pr = data.repository?.pullRequest
  if (!pr) {
    throw new GitHubError(
      `Pull request ${repo}#${number} was not found or is not visible to this token.`,
    )
  }

  const reviewThreads = pr.reviewThreads?.nodes ?? []
  const threadsTotalCount = pr.reviewThreads?.totalCount ?? 0
  const comments = pr.comments?.nodes ?? []
  const commentsTotalCount = pr.comments?.totalCount ?? 0
  const reviews = pr.reviews?.nodes ?? []
  const reviewsTotalCount = pr.reviews?.totalCount ?? 0

  return {
    id: pr.id,
    number: pr.number,
    title: pr.title,
    body: pr.body,
    url: pr.url,
    state: pr.state as PrState,
    isDraft: pr.isDraft,
    baseRefName: pr.baseRefName,
    headRefName: pr.headRefName,
    mergeable: pr.mergeable as Mergeable,
    reviewDecision: pr.reviewDecision as ReviewDecision,
    repo,
    reviewThreads: reviewThreads.map(toThread),
    threadsTruncated: reviewThreads.length < threadsTotalCount,
    comments: comments.map(toComment),
    commentsTruncated: comments.length < commentsTotalCount,
    reviews: reviews.map(toReviewSummary),
    reviewsTruncated: reviews.length < reviewsTotalCount,
  }
}

export function validateReviewBody(event: ReviewEvent, body: string): string | null {
  if (event === 'APPROVE') return null
  if (body.trim().length > 0) return null
  return event === 'REQUEST_CHANGES'
    ? 'Requesting changes needs a comment explaining what to change.'
    : 'A review comment needs a body.'
}

export async function submitReview(
  pullRequestId: string,
  event: ReviewEvent,
  body: string,
  creds: Credentials,
): Promise<string> {
  const problem = validateReviewBody(event, body)
  if (problem) throw new Error(problem)

  type SubmitReviewResponse = {
    addPullRequestReview?: { pullRequestReview?: { state: string } }
  }
  const data = await graphql<SubmitReviewResponse>(
    SUBMIT_REVIEW_MUTATION,
    { pullRequestId, event, body: body.trim() || null },
    creds,
  )

  const state = data.addPullRequestReview?.pullRequestReview?.state
  if (!state) throw new GitHubError('No state returned from submitReview mutation')
  return state
}

export async function replyToReviewThread(
  threadId: string,
  body: string,
  creds: Credentials,
): Promise<ReviewComment> {
  const trimmed = body.trim()
  if (!trimmed) throw new Error('A reply needs a body.')

  type ReplyResponse = {
    addPullRequestReviewThreadReply?: { comment?: RawComment }
  }
  const data = await graphql<ReplyResponse>(
    REPLY_TO_THREAD_MUTATION,
    { threadId, body: trimmed },
    creds,
  )

  const comment = data.addPullRequestReviewThreadReply?.comment
  if (!comment) throw new GitHubError('No comment returned from replyToReviewThread mutation')
  return toComment(comment)
}

export async function addConversationComment(
  pullRequestId: string,
  body: string,
  creds: Credentials,
): Promise<ReviewComment> {
  const trimmed = body.trim()
  if (!trimmed) throw new Error('A comment needs a body.')

  type AddCommentResponse = {
    addComment?: { commentEdge?: { node?: RawComment } }
  }
  const data = await graphql<AddCommentResponse>(
    ADD_COMMENT_MUTATION,
    { subjectId: pullRequestId, body: trimmed },
    creds,
  )

  const comment = data.addComment?.commentEdge?.node
  if (!comment) throw new GitHubError('No comment returned from addConversationComment mutation')
  return toComment(comment)
}

export type CloseResult = {
  closed: boolean
  commentPosted: boolean
  error?: string
}

function errorMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export async function closePullRequestWithComment(
  pullRequestId: string,
  commentBody: string | null,
  creds: Credentials,
): Promise<CloseResult> {
  let commentPosted = false

  if (commentBody?.trim()) {
    try {
      await addConversationComment(pullRequestId, commentBody, creds)
      commentPosted = true
    } catch (error) {
      if (error instanceof AuthError) throw error
      return {
        closed: false,
        commentPosted: false,
        error: `Could not post the closing comment: ${errorMsg(error)}`,
      }
    }
  }

  try {
    type ClosePrResponse = { closePullRequest?: { pullRequest?: { state: string } } }
    await graphql<ClosePrResponse>(CLOSE_PR_MUTATION, { pullRequestId }, creds)
    return { closed: true, commentPosted }
  } catch (error) {
    if (error instanceof AuthError) throw error
    return {
      closed: false,
      commentPosted,
      error: commentPosted
        ? `Comment posted, but closing the PR failed: ${errorMsg(error)}`
        : errorMsg(error),
    }
  }
}

export async function setDraftState(
  pullRequestId: string,
  draft: boolean,
  creds: Credentials,
): Promise<boolean> {
  if (draft) {
    type ConvertResponse = {
      convertPullRequestToDraft?: { pullRequest?: { isDraft: boolean } }
    }
    const data = await graphql<ConvertResponse>(CONVERT_TO_DRAFT_MUTATION, { pullRequestId }, creds)
    return data.convertPullRequestToDraft?.pullRequest?.isDraft ?? true
  } else {
    type MarkReadyResponse = {
      markPullRequestReadyForReview?: { pullRequest?: { isDraft: boolean } }
    }
    const data = await graphql<MarkReadyResponse>(MARK_READY_MUTATION, { pullRequestId }, creds)
    return data.markPullRequestReadyForReview?.pullRequest?.isDraft ?? false
  }
}
