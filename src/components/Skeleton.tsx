import type { CSSProperties } from 'react'

type Props = { label: string; rows?: number }

/**
 * A shaped placeholder rather than a line of centred text. The dashboard
 * auto-refreshes, so this is the surface people see most often, and a bare
 * "Loading…" throws the layout away and then throws it back.
 */
export default function Skeleton({ label, rows = 5 }: Props) {
  return (
    <div className="skeleton" role="status">
      <span className="skeleton-label">{label}</span>
      <div className="skeleton-rows" aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
          <div className="skeleton-row" key={i} style={{ '--i': i } as CSSProperties} />
        ))}
      </div>
    </div>
  )
}
