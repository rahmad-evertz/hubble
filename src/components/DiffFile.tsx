import { Fragment, useMemo, useState } from 'react'
import { parsePatch, indexThreadsByLine, threadsForLine } from '../lib/diff'
import type { PrFile, ReviewThread } from '../types'
import CommentThread from './CommentThread'

type Props = {
  file: PrFile
  threads: ReviewThread[]
  onReplyToThread: (threadId: string, body: string) => Promise<unknown>
}

export default function DiffFile({ file, threads, onReplyToThread }: Props) {
  const [expanded, setExpanded] = useState(true)
  const [threadsOpen, setThreadsOpen] = useState(true)

  const parsed = useMemo(() => parsePatch(file.patch), [file.patch])

  const threadIndex = useMemo(() => indexThreadsByLine(threads), [threads])

  const matchedThreadIds = useMemo(() => {
    if (!parsed.available) return new Set<string>()
    const matched = new Set<string>()
    for (const hunk of parsed.hunks) {
      for (const line of hunk.lines) {
        for (const thread of threadsForLine(line, threadIndex)) {
          matched.add(thread.id)
        }
      }
    }
    return matched
  }, [parsed, threadIndex])

  const orphanedThreads = useMemo(
    () => threads.filter((t) => !matchedThreadIds.has(t.id)),
    [threads, matchedThreadIds],
  )

  const statusBadgeMap: Record<string, { label: string; className: string }> = {
    added: { label: 'Added', className: 'badge-success' },
    removed: { label: 'Removed', className: 'badge-danger' },
    modified: { label: 'Modified', className: 'badge-neutral' },
    renamed: { label: 'Renamed', className: 'badge-neutral' },
    copied: { label: 'Copied', className: 'badge-neutral' },
    changed: { label: 'Changed', className: 'badge-neutral' },
    unchanged: { label: 'Unchanged', className: 'badge-neutral' },
  }
  const statusBadge = statusBadgeMap[file.status] || {
    label: file.status,
    className: 'badge-neutral',
  }

  const showFallback =
    !parsed.available || (file.status === 'renamed' && file.additions === 0 && file.deletions === 0)

  return (
    <div className="diff-file">
      <div className="diff-file-head">
        <button className="chevron" onClick={() => setExpanded(!expanded)}>
          {expanded ? '▼' : '▶'}
        </button>
        <span className="diff-file-path" title={file.path}>
          {file.path}
        </span>
        <span className={`badge ${statusBadge.className}`}>{statusBadge.label}</span>
        <span className="diff-file-stats">
          {file.additions > 0 && <span className="diff-add">+{file.additions}</span>}
          {file.deletions > 0 && <span className="diff-del">−{file.deletions}</span>}
        </span>
      </div>

      {expanded && (
        <div className="diff-file-body">
          {showFallback ? (
            <div className="diff-file-empty">
              {file.status === 'renamed' && file.additions === 0 && file.deletions === 0 ? (
                <>
                  <p>Renamed, no content changes</p>
                  {file.previousPath && (
                    <p className="text-muted">
                      ({file.previousPath} → {file.path})
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p>Not shown: binary or too large</p>
                  <a href={file.blobUrl} target="_blank" rel="noreferrer">
                    View on GitHub
                  </a>
                </>
              )}
            </div>
          ) : (
            <>
              {parsed.available && (
                <table className="diff">
                  {parsed.hunks.map((hunk, hunkIdx) => (
                    <tbody key={hunkIdx}>
                      <tr className="diff-hunk-head">
                        <td colSpan={4} className="diff-hunk-header">
                          @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                          {hunk.sectionHeading && ` ${hunk.sectionHeading}`}
                        </td>
                      </tr>
                      {hunk.lines.map((line, lineIdx) => (
                        <Fragment key={`${hunkIdx}-${lineIdx}`}>
                          <tr
                            className={`diff-line ${
                              line.type === 'add'
                                ? 'diff-line-add'
                                : line.type === 'del'
                                  ? 'diff-line-del'
                                  : ''
                            }`}
                          >
                            <td className="diff-gutter">
                              {line.oldLine !== null ? line.oldLine : ''}
                            </td>
                            <td className="diff-gutter">
                              {line.newLine !== null ? line.newLine : ''}
                            </td>
                            <td className="diff-sign">
                              {line.type === 'add' ? '+' : line.type === 'del' ? '\u2212' : ' '}
                            </td>
                            <td className="diff-content">
                              <code>{line.content}</code>
                              {line.noNewlineAtEnd && <span className="diff-no-newline"> ↵</span>}
                            </td>
                          </tr>
                          {threadsForLine(line, threadIndex).map((thread) => (
                            <tr key={`thread-${thread.id}`} className="diff-thread-row">
                              <td colSpan={4}>
                                <CommentThread
                                  comments={thread.comments}
                                  onReply={(body) => onReplyToThread(thread.id, body)}
                                  resolved={thread.isResolved}
                                  isOutdated={thread.isOutdated}
                                />
                              </td>
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </tbody>
                  ))}
                </table>
              )}

              {orphanedThreads.length > 0 && (
                <div className="diff-orphaned-threads">
                  <button
                    className="section-head"
                    aria-expanded={threadsOpen}
                    onClick={() => setThreadsOpen((v) => !v)}
                  >
                    <span className="chevron">{threadsOpen ? '▾' : '▸'}</span>
                    <span>Other comments on this file</span>
                    <span className="tab-count">{orphanedThreads.length}</span>
                  </button>
                  <div className={threadsOpen ? 'thread-stack' : 'thread-stack is-collapsed'}>
                    {orphanedThreads.map((thread) => (
                      <CommentThread
                        key={thread.id}
                        comments={thread.comments}
                        onReply={(body) => onReplyToThread(thread.id, body)}
                        resolved={thread.isResolved}
                        isOutdated={thread.isOutdated}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
